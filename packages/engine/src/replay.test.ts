import { describe, expect, it } from 'vitest';
import { checkSave, defineGame, issues, rank, replay, sum, type StoredGame } from './index';

// A toy two-phase game: guess, then actual; score = actual, +5 for an exact guess.
type Entry = { guess: number[]; actual?: number[] };
const toy = defineGame<{ rounds: number }, Entry>({
  id: 'toy',
  name: 'Toy',
  players: { min: 2, max: 4 },
  lowWins: false,
  config: { schema: { parse: (v) => v as { rounds: number } }, defaults: () => ({ rounds: 3 }) },
  entry: { parse: (v) => v as Partial<Entry> },
  phases: [
    { id: 'guess', label: 'Guess', validate: (e, ctx) => issues((e.guess?.length ?? 0) < ctx.seats && 'Everyone guesses') },
    { id: 'actual', label: 'Actual', validate: (e) => issues(sum(e.actual) !== 3 && 'Actual must total 3') },
  ],
  roundInfo: (ctx) => ({ dealer: ctx.dealer }),
  score: (e) => e.actual!.map((a, s) => a + (a === e.guess[s] ? 5 : 0)),
  isOver: ({ roundsPlayed, config }) => roundsPlayed === config.rounds,
});

const game = (rounds: StoredGame<{ rounds: number }, Entry>['rounds']): StoredGame<{ rounds: number }, Entry> => ({
  config: { rounds: 3 },
  seats: 3,
  firstDealer: 1,
  rounds,
});

describe('replay', () => {
  it('starts with the first phase of round 0 and the first dealer', () => {
    const v = replay(toy, game([]));
    expect(v.next).toEqual({ n: 0, dealer: 1, info: { dealer: 1 }, phase: 'guess' });
    expect(v.totals).toEqual([0, 0, 0]);
    expect(v.over).toBe(false);
  });

  it('asks for the second phase of a part-entered round', () => {
    const v = replay(toy, game([{ n: 0, phase: 'guess', entry: { guess: [1, 1, 1] } }]));
    expect(v.rounds[0].complete).toBe(false);
    expect(v.next?.phase).toBe('actual');
    expect(v.next?.n).toBe(0);
  });

  it('rotates the dealer, totals and finishes', () => {
    const r = (n: number, guess: number[], actual: number[]) => ({ n, phase: 'actual', entry: { guess, actual } });
    const v = replay(
      toy,
      game([r(0, [1, 1, 1], [1, 1, 1]), r(1, [0, 0, 0], [3, 0, 0]), r(2, [2, 1, 0], [2, 1, 0])]),
    );
    expect(v.rounds.map((x) => x.dealer)).toEqual([1, 2, 0]);
    expect(v.totals).toEqual([6 + 3 + 7, 6 + 5 + 6, 6 + 5 + 5]);
    expect(v.over).toBe(true);
    expect(v.next).toBeUndefined();
    expect(v.winners).toEqual([1]);
  });
});

describe('rank', () => {
  it('shares places on a tie', () => {
    expect(rank([10, 20, 10], true).map((s) => [s.side, s.place])).toEqual([[0, 1], [2, 1], [1, 3]]);
    expect(rank([10, 20, 20], false).map((s) => s.place)).toEqual([1, 1, 3]);
  });
});

describe('checkSave', () => {
  it('only accepts the next round, starting with its first phase', () => {
    const g = game([]);
    expect(checkSave(toy, g, { n: 1, phase: 'guess', entry: { guess: [1, 1, 1] } }).ok).toBe(false);
    expect(checkSave(toy, g, { n: 0, phase: 'actual', entry: {} }).ok).toBe(false);
    expect(checkSave(toy, g, { n: 0, phase: 'guess', entry: { guess: [1, 1, 1] } }).ok).toBe(true);
  });

  it('runs every phase validation up to the saved phase', () => {
    const g = game([{ n: 0, phase: 'guess', entry: { guess: [1, 1, 1] } }]);
    const bad = checkSave(toy, g, { n: 0, phase: 'actual', entry: { guess: [1, 1], actual: [1, 1, 1] } });
    expect(bad).toEqual({ ok: false, issues: [{ message: 'Everyone guesses' }] });
    const good = checkSave(toy, g, { n: 0, phase: 'actual', entry: { guess: [1, 1, 1], actual: [1, 1, 1] } });
    expect(good.ok).toBe(true);
  });

  it('lets a finished round be corrected only as a whole', () => {
    const g = game([{ n: 0, phase: 'actual', entry: { guess: [1, 1, 1], actual: [1, 1, 1] } }]);
    expect(checkSave(toy, g, { n: 0, phase: 'guess', entry: { guess: [0, 0, 0] } }).ok).toBe(false);
    expect(checkSave(toy, g, { n: 0, phase: 'actual', entry: { guess: [0, 0, 0], actual: [3, 0, 0] } }).ok).toBe(true);
  });
});
