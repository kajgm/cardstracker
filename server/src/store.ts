import { checkSave, gameId, replay, type AnyGameRules, type Issue, type StoredGame } from '@cards/engine';
import { getGame } from '@cards/games';
import { tx, type Db } from './db';

/** Player colors, handed out in order. Tokens the client maps to theme-aware values. */
const COLORS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

export interface Player {
  id: number;
  name: string;
  color: string;
  email: string | null;
}

export interface SeatedPlayer extends Player {
  seat: number;
  side: number;
}

/** What the API returns for one game. The client replays `rounds` itself. */
export interface GameDto {
  id: string;
  type: string;
  config: unknown;
  firstDealer: number;
  status: 'active' | 'finished' | 'hidden';
  version: number;
  createdBy: string | null;
  createdAt: string;
  finishedAt: string | null;
  players: SeatedPlayer[];
  rounds: { n: number; phase: string; entry: Record<string, unknown>; enteredBy: string | null }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Issue[] = [],
    readonly game?: GameDto,
  ) {
    super(message);
  }
}

interface GameRow {
  id: string;
  type: string;
  config: string;
  first_dealer: number;
  status: GameDto['status'];
  version: number;
  created_by: string | null;
  created_at: string;
  finished_at: string | null;
}

export function listPlayers(db: Db): Player[] {
  return db.prepare('SELECT id, name, color, email FROM players ORDER BY name').all() as unknown as Player[];
}

export function addPlayer(db: Db, name: string, email?: string): Player {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > 24) throw new ApiError(400, 'Names are 1 to 24 characters');
  const existing = db.prepare('SELECT id FROM players WHERE name = ?').get(clean);
  if (existing) throw new ApiError(409, `${clean} is already in the roster`);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number };
  const info = db
    .prepare('INSERT INTO players (name, color, email) VALUES (?, ?, ?)')
    .run(clean, COLORS[n % COLORS.length], email ?? null);
  return { id: Number(info.lastInsertRowid), name: clean, color: COLORS[n % COLORS.length], email: email ?? null };
}

export function playerForEmail(db: Db, email: string | undefined): Player | undefined {
  if (!email) return undefined;
  return db.prepare('SELECT id, name, color, email FROM players WHERE email = ? COLLATE NOCASE').get(email) as
    | Player
    | undefined;
}

function rulesFor(type: string): AnyGameRules {
  const rules = getGame(type);
  if (!rules) throw new ApiError(404, `No game called "${type}"`);
  return rules;
}

export function getGameDto(db: Db, id: string): GameDto {
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined;
  if (!row) throw new ApiError(404, `No game ${id}`);
  const players = db
    .prepare(
      `SELECT p.id, p.name, p.color, p.email, s.seat, s.side
       FROM seats s JOIN players p ON p.id = s.player_id WHERE s.game_id = ? ORDER BY s.seat`,
    )
    .all(id) as unknown as SeatedPlayer[];
  const rounds = (
    db.prepare('SELECT n, phase, entry, entered_by FROM rounds WHERE game_id = ? ORDER BY n').all(id) as {
      n: number;
      phase: string;
      entry: string;
      entered_by: string | null;
    }[]
  ).map((r) => ({ n: r.n, phase: r.phase, entry: JSON.parse(r.entry), enteredBy: r.entered_by }));
  return {
    id: row.id,
    type: row.type,
    config: JSON.parse(row.config),
    firstDealer: row.first_dealer,
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    players,
    rounds,
  };
}

export function stored(dto: GameDto): StoredGame {
  return { config: dto.config, seats: dto.players.length, firstDealer: dto.firstDealer, rounds: dto.rounds };
}

export interface NewGame {
  type: string;
  playerIds: number[];
  firstDealer?: number;
  config?: Record<string, unknown>;
}

export function createGame(db: Db, input: NewGame, user?: string): GameDto {
  const rules = rulesFor(input.type);
  const seats = input.playerIds.length;
  if (seats < rules.players.min || seats > rules.players.max) {
    throw new ApiError(400, `${rules.name} takes ${rules.players.min}–${rules.players.max} players`);
  }
  if (new Set(input.playerIds).size !== seats) throw new ApiError(400, 'A player can only sit once');
  const firstDealer = input.firstDealer ?? 0;
  if (firstDealer < 0 || firstDealer >= seats) throw new ApiError(400, 'The first dealer must be at the table');
  let config: unknown;
  try {
    config = rules.config.schema.parse({ ...rules.config.defaults(seats), ...input.config });
  } catch (err) {
    throw new ApiError(400, `Those house rules don't fit ${rules.name}: ${(err as Error).message}`);
  }
  const sides = rules.teams ? rules.teams(seats, config) : input.playerIds.map((_, s) => s);

  return tx(db, () => {
    const known = db
      .prepare(`SELECT COUNT(*) AS n FROM players WHERE id IN (${input.playerIds.map(() => '?').join(',')})`)
      .get(...input.playerIds) as { n: number };
    if (known.n !== seats) throw new ApiError(400, 'Every player has to be in the roster');
    let id = gameId();
    while (db.prepare('SELECT 1 FROM games WHERE id = ?').get(id)) id = gameId();
    db.prepare('INSERT INTO games (id, type, config, first_dealer, created_by) VALUES (?, ?, ?, ?, ?)').run(
      id,
      rules.id,
      JSON.stringify(config),
      firstDealer,
      user ?? null,
    );
    const seat = db.prepare('INSERT INTO seats (game_id, seat, player_id, side) VALUES (?, ?, ?, ?)');
    input.playerIds.forEach((pid, s) => seat.run(id, s, pid, sides[s]));
    return getGameDto(db, id);
  });
}

function bump(db: Db, dto: GameDto, expected: number) {
  if (expected !== dto.version) {
    throw new ApiError(409, 'Someone else saved this game a moment ago', [], dto);
  }
}

/** After any round change: recompute status and the results rows used for stats. */
function settle(db: Db, id: string): GameDto {
  const dto = getGameDto(db, id);
  const view = replay(rulesFor(dto.type), stored(dto));
  db.prepare('DELETE FROM results WHERE game_id = ?').run(id);
  if (view.over) {
    const place = new Map(view.standings.map((s) => [s.side, s.place]));
    const ins = db.prepare('INSERT INTO results (game_id, player_id, total, place) VALUES (?, ?, ?, ?)');
    for (const p of dto.players) ins.run(id, p.id, view.totals[p.side], place.get(p.side)!);
    if (dto.status !== 'finished') {
      db.prepare(`UPDATE games SET status = 'finished', finished_at = datetime('now') WHERE id = ?`).run(id);
    }
  } else if (dto.status === 'finished') {
    db.prepare(`UPDATE games SET status = 'active', finished_at = NULL WHERE id = ?`).run(id);
  }
  db.prepare('UPDATE games SET version = version + 1 WHERE id = ?').run(id);
  return getGameDto(db, id);
}

export function saveRound(
  db: Db,
  id: string,
  n: number,
  body: { phase: string; entry: unknown; version: number },
  user?: string,
): GameDto {
  return tx(db, () => {
    const dto = getGameDto(db, id);
    bump(db, dto, body.version);
    const check = checkSave(rulesFor(dto.type), stored(dto), { n, phase: body.phase, entry: body.entry });
    if (!check.ok) throw new ApiError(422, check.issues[0].message, check.issues);
    db.prepare(
      `INSERT INTO rounds (game_id, n, phase, entry, entered_by) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (game_id, n) DO UPDATE SET phase = excluded.phase, entry = excluded.entry,
         entered_by = excluded.entered_by, updated_at = datetime('now')`,
    ).run(id, n, body.phase, JSON.stringify(check.entry), user ?? null);
    return settle(db, id);
  });
}

export function undoRound(db: Db, id: string, n: number, version: number): GameDto {
  return tx(db, () => {
    const dto = getGameDto(db, id);
    bump(db, dto, version);
    const last = dto.rounds[dto.rounds.length - 1];
    if (!last || last.n !== n) throw new ApiError(400, 'Only the last round can be undone');
    db.prepare('DELETE FROM rounds WHERE game_id = ? AND n = ?').run(id, n);
    return settle(db, id);
  });
}

export function rematch(db: Db, id: string, user?: string): GameDto {
  const dto = getGameDto(db, id);
  return createGame(
    db,
    {
      type: dto.type,
      playerIds: dto.players.map((p) => p.id),
      firstDealer: (dto.firstDealer + 1) % dto.players.length,
      config: dto.config as Record<string, unknown>,
    },
    user,
  );
}

export interface GameSummary {
  id: string;
  type: string;
  status: GameDto['status'];
  createdAt: string;
  finishedAt: string | null;
  round: number;
  players: { name: string; color: string; total: number; place: number }[];
}

export function listGames(db: Db, filter: { type?: string; status?: string; limit?: number }): GameSummary[] {
  const where: string[] = [`status != 'hidden'`];
  const args: string[] = [];
  if (filter.type) (where.push('type = ?'), args.push(filter.type));
  if (filter.status) (where.push('status = ?'), args.push(filter.status));
  const ids = db
    .prepare(`SELECT id FROM games WHERE ${where.join(' AND ')} ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .all(...args, filter.limit ?? 50) as { id: string }[];
  return ids.map(({ id }) => {
    const dto = getGameDto(db, id);
    const rules = getGame(dto.type);
    const view = rules ? replay(rules, stored(dto)) : undefined;
    const place = new Map(view?.standings.map((s) => [s.side, s.place]));
    return {
      id,
      type: dto.type,
      status: dto.status,
      createdAt: dto.createdAt,
      finishedAt: dto.finishedAt,
      round: (view?.next?.n ?? view?.rounds.length ?? 0) + 1,
      players: dto.players.map((p) => ({
        name: p.name,
        color: p.color,
        total: view?.totals[p.side] ?? 0,
        place: place.get(p.side) ?? 0,
      })),
    };
  });
}

export function hideGame(db: Db, id: string): void {
  const info = db.prepare(`UPDATE games SET status = 'hidden', version = version + 1 WHERE id = ?`).run(id);
  if (!info.changes) throw new ApiError(404, `No game ${id}`);
}

export interface LeaderRow {
  playerId: number;
  name: string;
  color: string;
  played: number;
  won: number;
  avg: number;
}

export function leaderboard(db: Db, type: string): LeaderRow[] {
  rulesFor(type);
  return db
    .prepare(
      `SELECT p.id AS playerId, p.name, p.color, COUNT(*) AS played,
              SUM(r.place = 1) AS won, ROUND(AVG(r.total), 1) AS avg
       FROM results r JOIN games g ON g.id = r.game_id JOIN players p ON p.id = r.player_id
       WHERE g.type = ? AND g.status = 'finished'
       GROUP BY p.id ORDER BY won DESC, avg ${getGame(type)!.lowWins ? 'ASC' : 'DESC'}`,
    )
    .all(type) as unknown as LeaderRow[];
}
