import { checkSave, computeStats, gameId, replay, type AnyGameRules, type Issue, type RoundInfo, type StoredGame } from '@cards/engine';
import { games, getGame } from '@cards/games';
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
  /** Ended by the players before the target or the last hand. */
  endedEarly: boolean;
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
  ended_early: number;
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
    endedEarly: !!row.ended_early,
    players,
    rounds,
  };
}

export function stored(dto: GameDto): StoredGame {
  return {
    config: dto.config,
    seats: dto.players.length,
    firstDealer: dto.firstDealer,
    rounds: dto.rounds,
    endedEarly: dto.endedEarly,
  };
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

/** Ends a game before its target or last hand; the standings after the last complete round stand. */
export function endGame(db: Db, id: string, version: number): GameDto {
  return tx(db, () => {
    const dto = getGameDto(db, id);
    bump(db, dto, version);
    if (dto.status !== 'active') throw new ApiError(400, 'This game is already over');
    const view = replay(rulesFor(dto.type), stored(dto));
    if (!view.rounds.some((r) => r.complete)) throw new ApiError(400, 'Finish a round before ending the game');
    db.prepare('UPDATE games SET ended_early = 1 WHERE id = ?').run(id);
    return settle(db, id);
  });
}

/** Undoes endGame: the game carries on from where it stopped. */
export function resumeGame(db: Db, id: string, version: number): GameDto {
  return tx(db, () => {
    const dto = getGameDto(db, id);
    bump(db, dto, version);
    if (!dto.endedEarly) throw new ApiError(400, 'This game was not ended early');
    db.prepare('UPDATE games SET ended_early = 0 WHERE id = ?').run(id);
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
  /** When a round was last saved, or when the game started. UTC, SQLite format. */
  updatedAt: string;
  round: number;
  firstDealer: number;
  endedEarly: boolean;
  /** What is being played now; null once the game is over. */
  next: { n: number; info: RoundInfo; dealer: string } | null;
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
    const { updated } = db
      .prepare('SELECT MAX(updated_at) AS updated FROM rounds WHERE game_id = ?')
      .get(id) as { updated: string | null };
    const next = view?.next;
    return {
      id,
      type: dto.type,
      status: dto.status,
      createdAt: dto.createdAt,
      finishedAt: dto.finishedAt,
      updatedAt: updated ?? dto.createdAt,
      round: (next?.n ?? view?.rounds.length ?? 0) + 1,
      firstDealer: dto.firstDealer,
      endedEarly: dto.endedEarly,
      next: next ? { n: next.n, info: next.info, dealer: dto.players[next.dealer]?.name ?? '' } : null,
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
  /** Average final score; null across all games, where scores don't compare. */
  avg: number | null;
  /** Places in the last five finished games, oldest first. */
  form: number[];
}

/** Finished results in the order the games finished. */
function finishedResults(db: Db, type?: string) {
  return db
    .prepare(
      `SELECT r.game_id AS gameId, r.player_id AS playerId, p.name, p.color, g.type, r.total, r.place
       FROM results r JOIN games g ON g.id = r.game_id JOIN players p ON p.id = r.player_id
       WHERE g.status = 'finished' ${type ? 'AND g.type = ?' : ''}
       ORDER BY g.finished_at, g.rowid`,
    )
    .all(...(type ? [type] : [])) as unknown as {
    gameId: string;
    playerId: number;
    name: string;
    color: string;
    type: string;
    total: number;
    place: number;
  }[];
}

/** One game's table, or 'all': wins add up across games; averages only within one game. */
export function leaderboard(db: Db, type: string): LeaderRow[] {
  const all = type === 'all';
  const rules = all ? undefined : rulesFor(type);
  const by = new Map<number, LeaderRow & { sum: number }>();
  for (const r of finishedResults(db, rules?.id)) {
    const row = by.get(r.playerId) ?? { playerId: r.playerId, name: r.name, color: r.color, played: 0, won: 0, avg: null, form: [], sum: 0 };
    row.played++;
    row.won += r.place === 1 ? 1 : 0;
    row.sum += r.total;
    row.form = [...row.form, r.place].slice(-5);
    by.set(r.playerId, row);
  }
  const rows = [...by.values()].map(({ sum, ...row }) => ({
    ...row,
    avg: rules ? Math.round((sum / row.played) * 10) / 10 : null,
  }));
  const rate = (r: LeaderRow) => r.won / r.played;
  return rows.sort(
    (a, b) =>
      b.won - a.won ||
      (rules ? (rules.lowWins ? a.avg! - b.avg! : b.avg! - a.avg!) : rate(b) - rate(a)) ||
      a.name.localeCompare(b.name),
  );
}

export interface RecordLine {
  label: string;
  value: string;
  name: string;
  color: string;
  /** The game a single-game record came from. */
  gameId?: string;
  type?: string;
}

/** Rate stats need this many rounds before they count as a record. */
const MIN_RATE_ROUNDS = 10;

/** All-time bests: longest win streak, each game's best final score, and each game's own stats. */
export function records(db: Db): RecordLine[] {
  const out: RecordLine[] = [];
  const results = finishedResults(db);

  const streak = new Map<number, { run: number; best: number; name: string; color: string }>();
  for (const r of results) {
    const s = streak.get(r.playerId) ?? { run: 0, best: 0, name: r.name, color: r.color };
    s.run = r.place === 1 ? s.run + 1 : 0;
    s.best = Math.max(s.best, s.run);
    streak.set(r.playerId, s);
  }
  const longest = [...streak.values()].sort((a, b) => b.best - a.best)[0];
  if (longest && longest.best >= 2) out.push({ label: 'Win streak', value: String(longest.best), name: longest.name, color: longest.color });

  for (const rules of Object.values(games)) {
    const mine = results.filter((r) => r.type === rules.id);
    const candidates = rules.lowWins ? mine.filter((r) => r.place === 1) : mine;
    const best = [...candidates].sort((a, b) => (rules.lowWins ? a.total - b.total : b.total - a.total))[0];
    if (best) {
      out.push({ label: `Best ${rules.name} game`, value: String(best.total), name: best.name, color: best.color, gameId: best.gameId, type: rules.id });
    }

    if (!rules.stats?.length) continue;
    const ids = [...new Set(mine.map((r) => r.gameId))];
    const finalPhase = rules.phases[rules.phases.length - 1].id;
    const tally = rules.stats.map(() => new Map<number, { hits: number; rounds: number; name: string; color: string }>());
    for (const id of ids) {
      const dto = getGameDto(db, id);
      const done = dto.rounds.filter((r) => r.phase === finalPhase).length;
      computeStats(rules, stored(dto)).forEach((line, i) => {
        dto.players.forEach((p) => {
          const t = tally[i].get(p.id) ?? { hits: 0, rounds: 0, name: p.name, color: p.color };
          t.hits += line.kind === 'rate' ? Math.round(line.values[p.seat] * done) : line.values[p.seat];
          t.rounds += done;
          tally[i].set(p.id, t);
        });
      });
    }
    rules.stats.forEach((stat, i) => {
      const rows = [...tally[i].values()];
      if (stat.kind === 'count') {
        const top = rows.sort((a, b) => b.hits - a.hits)[0];
        if (top && top.hits > 0) out.push({ label: stat.label, value: String(top.hits), name: top.name, color: top.color, type: rules.id });
      } else {
        const top = rows.filter((t) => t.rounds >= MIN_RATE_ROUNDS).sort((a, b) => b.hits / b.rounds - a.hits / a.rounds)[0];
        if (top) out.push({ label: stat.label, value: `${Math.round((top.hits / top.rounds) * 100)}%`, name: top.name, color: top.color, type: rules.id });
      }
    });
  }
  return out;
}
