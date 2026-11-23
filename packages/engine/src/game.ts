// The whole contract a game implements. Everything that every game shares
// (dealer rotation, walking the rounds, totals, ranking, what to enter next)
// lives in replay.ts; a game only supplies what is specific to it.

/** 0..n-1, clockwise from the first dealer. */
export type Seat = number;

/** Anything with a zod-style `parse`. Keeps the engine free of a zod dependency. */
export interface Schema<T> {
  parse(value: unknown): T;
}

export interface Issue {
  message: string;
}

/** Facts about one round that the UI shows: pass direction, hand size, first bidder… */
export type RoundInfo = Record<string, unknown>;

export interface RoundResult {
  n: number;
  /** Points per side for this round. */
  points: number[];
}

export interface RoundCtx<Cfg> {
  /** House rules chosen when the game started. */
  config: Cfg;
  seats: number;
  /** 0-based round index. */
  round: number;
  /** Rotated by the engine; games only read it. */
  dealer: Seat;
  /** Completed earlier rounds (Spades bags, streaks). */
  history: RoundResult[];
}

export interface Phase<Cfg, Entry> {
  /** 'result' | 'bids' | 'tricks' … */
  id: string;
  label: string;
  /** An empty list means the phase can be saved. */
  validate(entry: Partial<Entry>, ctx: RoundCtx<Cfg>): Issue[];
}

export interface Progress<Cfg> {
  config: Cfg;
  seats: number;
  /** Totals per side after the completed rounds. */
  totals: number[];
  roundsPlayed: number;
}

export type StatDef<Entry> =
  | {
      kind: 'count';
      label: string;
      /** Seats that score one this round, e.g. who took the queen of spades. */
      seatsOf(entry: Entry): Seat[];
    }
  | {
      kind: 'rate';
      label: string;
      /** Whether this seat hit this round, e.g. made their bid. */
      hit(entry: Entry, seat: Seat): boolean;
    };

export interface GameRules<Cfg, Entry> {
  /** URL slug: cards.kajgm.com/<id>. */
  id: string;
  name: string;
  players: { min: number; max: number };
  lowWins: boolean;
  /** Seat → side. Default: everyone plays alone. */
  teams?(seats: number, config: Cfg): number[];
  config: { schema: Schema<Cfg>; defaults(seats: number): Cfg };
  /** The server parses every save with this; it must accept a round part-way through its phases. */
  entry: Schema<Partial<Entry>>;
  /** Hearts: [result] · 10-1: [bids, tricks]. */
  phases: Phase<Cfg, Entry>[];
  roundInfo(ctx: RoundCtx<Cfg>): RoundInfo;
  /** Points per side for one completed round. */
  score(entry: Entry, ctx: RoundCtx<Cfg>): number[];
  /** Target reached, or last hand played. */
  isOver(progress: Progress<Cfg>): boolean;
  stats?: StatDef<Entry>[];
}

/** Identity helper that keeps Cfg and Entry inferred at the call site. */
export const defineGame = <Cfg, Entry>(rules: GameRules<Cfg, Entry>): GameRules<Cfg, Entry> =>
  rules;

/** The registry and server handle games without knowing their types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameRules = GameRules<any, any>;
