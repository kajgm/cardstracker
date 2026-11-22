import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Each entry runs once, in order; PRAGMA user_version records how far we got.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE players (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color      TEXT NOT NULL,
    email      TEXT,                                  -- optional link to an Access login
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE games (
    id           TEXT PRIMARY KEY,                    -- short code, e.g. k7f2q
    type         TEXT NOT NULL,                       -- hearts, tenone, ...
    config       TEXT NOT NULL,                       -- JSON house rules, checked by the game's schema
    first_dealer INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'active',      -- active | finished | hidden
    version      INTEGER NOT NULL DEFAULT 0,
    created_by   TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at  TEXT
  );
  CREATE INDEX games_type_status ON games(type, status);
  CREATE TABLE seats (
    game_id   TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    seat      INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id),
    side      INTEGER NOT NULL,
    PRIMARY KEY (game_id, seat)
  );
  CREATE TABLE rounds (
    game_id    TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    n          INTEGER NOT NULL,
    phase      TEXT NOT NULL,                         -- last phase saved
    entry      TEXT NOT NULL,                         -- JSON, one game's shape
    entered_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (game_id, n)
  );
  -- Written when a game finishes; can be rebuilt from rounds.
  CREATE TABLE results (
    game_id   TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id),
    total     INTEGER NOT NULL,
    place     INTEGER NOT NULL,
    PRIMARY KEY (game_id, player_id)
  );
  `,
];

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  return db;
}

/** Runs fn in a transaction; node:sqlite has no helper for it. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Writes today's consistent copy to <dir>/cards-YYYY-MM-DD.db if it is missing
 * and keeps the newest `keep`. VACUUM INTO is safe while the app is writing.
 */
export function backup(db: Db, dir: string, keep = 14, today = new Date()): string | undefined {
  mkdirSync(dir, { recursive: true });
  const name = `cards-${today.toISOString().slice(0, 10)}.db`;
  const files = readdirSync(dir).filter((f) => /^cards-\d{4}-\d{2}-\d{2}\.db$/.test(f));
  let made: string | undefined;
  if (!files.includes(name)) {
    const target = join(dir, name);
    db.prepare('VACUUM INTO ?').run(target);
    files.push(name);
    made = target;
  }
  files.sort().slice(0, Math.max(0, files.length - keep)).forEach((f) => rmSync(join(dir, f)));
  return made;
}
