import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io as connect, type Socket } from 'socket.io-client';
import { backup, openDb } from '../src/db';
import { createApp } from '../src/app';
import type { GameDto } from '../src/store';

const db = openDb(':memory:');
const { http, io } = createApp({ db, version: '9.9.9', ownerEmail: 'owner@example.com' });
let base = '';

beforeAll(async () => {
  await new Promise<void>((done) => http.listen(0, done));
  base = `http://localhost:${(http.address() as AddressInfo).port}`;
});
afterAll(() => {
  io.close();
  http.close();
});

async function call<T = unknown>(method: string, path: string, body?: unknown, email = 'ana@example.com') {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', 'cf-access-authenticated-user-email': email },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (res.status === 204 ? null : await res.json()) as T };
}

async function seatFour(): Promise<number[]> {
  const ids: number[] = [];
  for (const name of ['Mom', 'Dad', 'Ana', 'Theo']) {
    const existing = (await call<{ id: number; name: string }[]>('GET', '/api/players')).body.find((p) => p.name === name);
    ids.push(existing ? existing.id : (await call<{ id: number }>('POST', '/api/players', { name })).body.id);
  }
  return ids;
}

describe('api', () => {
  it('answers health and version checks', async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect(await (await fetch(`${base}/version.json`)).json()).toEqual({ version: '9.9.9' });
  });

  it('reads the Access email', async () => {
    expect((await call('GET', '/api/me')).body).toMatchObject({ email: 'ana@example.com', owner: false });
  });

  it('keeps one roster entry per name', async () => {
    await seatFour();
    expect((await call('POST', '/api/players', { name: 'mom' })).status).toBe(409);
  });

  it('plays a hearts round, pushes it to the room and rejects stale saves', async () => {
    const playerIds = await seatFour();
    const created = await call<GameDto>('POST', '/api/games', { type: 'hearts', playerIds, firstDealer: 0 });
    expect(created.status).toBe(201);
    const game = created.body;
    expect(game.config).toEqual({ target: 100, moon: 'choose', jackMinus10: false });

    const socket: Socket = connect(base, { transports: ['websocket'] });
    await new Promise<void>((done) => socket.on('connect', () => done()));
    socket.emit('join', game.id);
    await new Promise((done) => setTimeout(done, 50));
    const pushed = new Promise<GameDto>((done) => socket.on('game:state', done));

    const bad = await call('PUT', `/api/games/${game.id}/rounds/0`, {
      phase: 'result',
      entry: { queen: 1, hearts: [3, 3, 3, 3] },
      version: game.version,
    });
    expect(bad.status).toBe(422);

    const saved = await call<GameDto>('PUT', `/api/games/${game.id}/rounds/0`, {
      phase: 'result',
      entry: { queen: 1, hearts: [3, 4, 2, 4] },
      version: game.version,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.rounds).toEqual([
      { n: 0, phase: 'result', entry: { queen: 1, hearts: [3, 4, 2, 4] }, enteredBy: 'ana@example.com' },
    ]);
    expect((await pushed).version).toBe(saved.body.version);
    socket.close();

    const stale = await call<{ error: string; game: GameDto }>('PUT', `/api/games/${game.id}/rounds/1`, {
      phase: 'result',
      entry: { queen: 0, hearts: [13, 0, 0, 0], moon: 'self-26' },
      version: game.version,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.game.version).toBe(saved.body.version);

    const undone = await call<GameDto>('DELETE', `/api/games/${game.id}/rounds/0?version=${saved.body.version}`);
    expect(undone.body.rounds).toEqual([]);
  });

  it('finishes a game, records results and builds the leaderboard', async () => {
    const playerIds = (await seatFour()).slice(0, 3);
    const { body: game } = await call<GameDto>('POST', '/api/games', {
      type: 'tenone',
      playerIds,
      config: { start: 3 },
    });
    let version = game.version;
    // Hands of 3, 2, 1 cards. Dealer rotates from seat 0; hook keeps bids off the hand size.
    const hands = [
      { bids: [1, 1, 0], tricks: [1, 1, 1] },
      { bids: [1, 0, 0], tricks: [1, 0, 1] },
      { bids: [0, 0, 0], tricks: [1, 0, 0] },
    ];
    for (const [n, h] of hands.entries()) {
      const b = await call<GameDto>('PUT', `/api/games/${game.id}/rounds/${n}`, { phase: 'bids', entry: { bids: h.bids }, version });
      expect(b.status).toBe(200);
      const t = await call<GameDto>('PUT', `/api/games/${game.id}/rounds/${n}`, { phase: 'tricks', entry: h, version: b.body.version });
      expect(t.status).toBe(200);
      version = t.body.version;
    }
    const final = await call<GameDto>('GET', `/api/games/${game.id}`);
    expect(final.body.status).toBe('finished');
    const board = await call<{ name: string; won: number; played: number }[]>('GET', '/api/stats/tenone');
    expect(board.body[0]).toMatchObject({ name: 'Dad', won: 1, played: 1 });
    const stats = await call<{ label: string; values: number[] }[]>('GET', `/api/games/${game.id}/stats`);
    expect(stats.body[0].label).toBe('Bid accuracy');

    const again = await call<GameDto>('POST', `/api/games/${game.id}/rematch`);
    expect(again.body.firstDealer).toBe(1);
    expect(again.body.config).toEqual(final.body.config);
  });

  it('refuses unknown games and keeps export for the owner', async () => {
    expect((await call('GET', '/api/stats/poker')).status).toBe(404);
    expect((await call('GET', '/api/export')).status).toBe(403);
    expect((await call('GET', '/api/export', undefined, 'owner@example.com')).status).toBe(200);
  });
});

describe('backup', () => {
  it('writes one copy a day and keeps the newest 14', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cards-backup-'));
    try {
      for (let d = 1; d <= 16; d++) backup(db, dir, 14, new Date(Date.UTC(2026, 10, d)));
      expect(backup(db, dir, 14, new Date(Date.UTC(2026, 10, 16)))).toBeUndefined();
      const files = readdirSync(dir).sort();
      expect(files).toHaveLength(14);
      expect(files[0]).toBe('cards-2026-11-03.db');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
