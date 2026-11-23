import type { AnyGameRules, GameRules, Issue, RoundCtx, RoundInfo, RoundResult, Seat } from './game';

/** One stored round: the phase saved last and everything entered so far. */
export interface StoredRound<Entry = unknown> {
  n: number;
  phase: string;
  entry: Partial<Entry>;
}

/** What the database keeps per game. Totals are never stored: they are replayed. */
export interface StoredGame<Cfg = unknown, Entry = unknown> {
  config: Cfg;
  seats: number;
  firstDealer: Seat;
  rounds: StoredRound<Entry>[];
  /** Ended by the players before the target or the last hand; standings after the last complete round stand. */
  endedEarly?: boolean;
}

export interface RoundView<Entry = unknown> {
  n: number;
  dealer: Seat;
  info: RoundInfo;
  phase: string;
  complete: boolean;
  entry: Partial<Entry>;
  /** Points per side, once the round is complete. */
  points?: number[];
  /** Running totals per side after this round. */
  totals: number[];
}

export interface Standing {
  side: number;
  total: number;
  /** 1-based; ties share a place. */
  place: number;
}

export interface NextStep {
  n: number;
  dealer: Seat;
  info: RoundInfo;
  phase: string;
}

export interface GameView<Entry = unknown> {
  /** Seat → side. */
  sides: number[];
  sideCount: number;
  rounds: RoundView<Entry>[];
  totals: number[];
  standings: Standing[];
  /** What to enter now; absent once the game is over. */
  next?: NextStep;
  over: boolean;
  /** Winning sides (more than one on a tie). Empty until the game is over. */
  winners: number[];
  /** Over because the players ended it, not because the rules say so. */
  endedEarly: boolean;
}

function sidesFor<Cfg>(rules: GameRules<Cfg, unknown>, seats: number, config: Cfg): number[] {
  return rules.teams ? rules.teams(seats, config) : Array.from({ length: seats }, (_, s) => s);
}

export function rank(totals: number[], lowWins: boolean): Standing[] {
  const order = totals
    .map((total, side) => ({ side, total }))
    .sort((a, b) => (lowWins ? a.total - b.total : b.total - a.total) || a.side - b.side);
  return order.map((s) => ({
    ...s,
    place: 1 + order.filter((o) => (lowWins ? o.total < s.total : o.total > s.total)).length,
  }));
}

/**
 * Walks the stored rounds in order and derives everything the screens and the
 * server need. Pure: the server and every phone run the same function.
 */
export function replay<Cfg, Entry>(
  rules: GameRules<Cfg, Entry>,
  game: StoredGame<Cfg, Entry>,
): GameView<Entry> {
  const { config, seats } = game;
  const sides = sidesFor(rules as GameRules<Cfg, unknown>, seats, config);
  const sideCount = Math.max(...sides) + 1;
  const finalPhase = rules.phases[rules.phases.length - 1].id;
  const totals = new Array<number>(sideCount).fill(0);
  const history: RoundResult[] = [];
  const rounds: RoundView<Entry>[] = [];
  const ordered = [...game.rounds].sort((a, b) => a.n - b.n);

  let over = false;
  for (const stored of ordered) {
    const ctx = contextFor(rules, game, stored.n, history);
    const info = rules.roundInfo(ctx);
    const complete = stored.phase === finalPhase;
    let points: number[] | undefined;
    if (complete) {
      points = rules.score(stored.entry as Entry, ctx);
      points.forEach((p, side) => (totals[side] += p));
      history.push({ n: stored.n, points });
      over = rules.isOver({ config, seats, totals: [...totals], roundsPlayed: history.length });
    }
    rounds.push({
      n: stored.n,
      dealer: ctx.dealer,
      info,
      phase: stored.phase,
      complete,
      entry: stored.entry,
      points,
      totals: [...totals],
    });
    if (over) break;
  }
  // Ended early: the game stops after its last complete round; a half-entered one is set aside.
  const endedEarly = !over && !!game.endedEarly && history.length > 0;
  if (endedEarly) {
    over = true;
    while (rounds.length && !rounds[rounds.length - 1].complete) rounds.pop();
  }

  const standings = rank(totals, rules.lowWins);
  let next: NextStep | undefined;
  if (!over) {
    const last = rounds[rounds.length - 1];
    if (last && !last.complete) {
      const idx = rules.phases.findIndex((p) => p.id === last.phase);
      next = { n: last.n, dealer: last.dealer, info: last.info, phase: rules.phases[idx + 1].id };
    } else {
      const n = rounds.length;
      const ctx = contextFor(rules, game, n, history);
      next = { n, dealer: ctx.dealer, info: rules.roundInfo(ctx), phase: rules.phases[0].id };
    }
  }

  return {
    sides,
    sideCount,
    rounds,
    totals,
    standings,
    next,
    over,
    winners: over ? standings.filter((s) => s.place === 1).map((s) => s.side) : [],
    endedEarly,
  };
}

/** The context round n is played in: its dealer and the rounds completed before it. */
export function roundContext<Cfg, Entry>(
  rules: GameRules<Cfg, Entry>,
  game: StoredGame<Cfg, Entry>,
  n: number,
): RoundCtx<Cfg> {
  const before = replay(rules, { ...game, rounds: game.rounds.filter((r) => r.n < n) });
  const history = before.rounds.filter((r) => r.complete).map((r) => ({ n: r.n, points: r.points! }));
  return contextFor(rules, game, n, history);
}

/** Every phase's issues up to and including `phase`: what the server will check. */
export function phaseIssues<Cfg, Entry>(
  rules: GameRules<Cfg, Entry>,
  phase: string,
  entry: Partial<Entry>,
  ctx: RoundCtx<Cfg>,
): Issue[] {
  const idx = rules.phases.findIndex((p) => p.id === phase);
  return rules.phases.slice(0, idx + 1).flatMap((p) => p.validate(entry, ctx));
}

function contextFor<Cfg, Entry>(
  rules: GameRules<Cfg, Entry>,
  game: StoredGame<Cfg, Entry>,
  n: number,
  history: RoundResult[],
): RoundCtx<Cfg> {
  void rules;
  return {
    config: game.config,
    seats: game.seats,
    round: n,
    dealer: (game.firstDealer + n) % game.seats,
    history: history.filter((h) => h.n < n),
  };
}

export interface SaveRequest {
  n: number;
  phase: string;
  entry: unknown;
}

export type SaveCheck<Entry> =
  | { ok: true; entry: Partial<Entry> }
  | { ok: false; issues: Issue[] };

/**
 * Decides whether a round may be saved: the right round and phase, an entry
 * that parses, and every phase up to this one valid. The server calls this
 * before writing; the editors call the phases' validate() directly.
 */
export function checkSave<Cfg, Entry>(
  rules: GameRules<Cfg, Entry>,
  game: StoredGame<Cfg, Entry>,
  save: SaveRequest,
): SaveCheck<Entry> {
  const fail = (message: string): SaveCheck<Entry> => ({ ok: false, issues: [{ message }] });
  const phaseIdx = rules.phases.findIndex((p) => p.id === save.phase);
  if (phaseIdx < 0) return fail(`Unknown phase "${save.phase}"`);
  const finalIdx = rules.phases.length - 1;

  const view = replay(rules, game);
  const existing = game.rounds.find((r) => r.n === save.n);
  if (existing) {
    const savedIdx = rules.phases.findIndex((p) => p.id === existing.phase);
    const isLast = save.n === Math.max(...game.rounds.map((r) => r.n));
    if (savedIdx === finalIdx && phaseIdx !== finalIdx) {
      return fail(`Round ${save.n + 1} is finished; correct it with all of its phases`);
    }
    if (view.endedEarly && savedIdx < finalIdx) return fail('This game was ended; resume it to keep playing');
    if (savedIdx < finalIdx && (!isLast || phaseIdx > savedIdx + 1)) {
      return fail(`Round ${save.n + 1} needs "${rules.phases[savedIdx + 1].label}" next`);
    }
  } else {
    if (view.over) return fail('This game is over');
    if (!view.next || save.n !== view.next.n) return fail(`The next round is ${(view.next?.n ?? 0) + 1}`);
    if (phaseIdx !== 0) return fail(`Start round ${save.n + 1} with "${rules.phases[0].label}"`);
  }

  let entry: Partial<Entry>;
  try {
    entry = rules.entry.parse(save.entry);
  } catch (err) {
    return fail(`That entry doesn't fit ${rules.name}: ${(err as Error).message}`);
  }

  const problems = phaseIssues(rules, save.phase, entry, roundContext(rules, game, save.n));
  return problems.length ? { ok: false, issues: problems } : { ok: true, entry };
}

export interface StatLine {
  label: string;
  kind: 'count' | 'rate';
  /** Per seat: a count, or a share between 0 and 1. */
  values: number[];
}

/** The game's own stats over its completed rounds. */
export function computeStats(rules: AnyGameRules, game: StoredGame): StatLine[] {
  const finalPhase = rules.phases[rules.phases.length - 1].id;
  const done = game.rounds.filter((r) => r.phase === finalPhase);
  return (rules.stats ?? []).map((stat) => {
    const values = new Array<number>(game.seats).fill(0);
    for (const r of done) {
      if (stat.kind === 'count') stat.seatsOf(r.entry).forEach((s: Seat) => values[s]++);
      else values.forEach((_, s) => (values[s] += stat.hit(r.entry, s) ? 1 : 0));
    }
    return {
      label: stat.label,
      kind: stat.kind,
      values: stat.kind === 'rate' && done.length ? values.map((v) => v / done.length) : values,
    };
  });
}
