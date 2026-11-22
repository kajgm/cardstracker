import { describe, expect, it } from 'vitest';
import { replay, type StoredGame } from '@cards/engine';
import tenone, { handSize, totalRounds, type TenoneConfig, type TenoneEntry } from './rules';

const cfg = (over: Partial<TenoneConfig> = {}, seats = 5): TenoneConfig => ({ ...tenone.config.defaults(seats), ...over });
const ctx = (round: number, config = cfg(), seats = 5) => ({ config, seats, round, dealer: 3, history: [] });
const msgs = (phase: number, e: Partial<TenoneEntry>, c = ctx(3)) => tenone.phases[phase].validate(e, c).map((i) => i.message);

describe('10-1 hands', () => {
  it('deals 10 down to 1, or back up again', () => {
    expect(Array.from({ length: 10 }, (_, r) => handSize(r, 10))).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(Array.from({ length: 19 }, (_, r) => handSize(r, 10)).slice(8)).toEqual([2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(totalRounds({ start: 10, upAgain: false })).toBe(10);
    expect(totalRounds({ start: 10, upAgain: true })).toBe(19);
  });

  it('starts lower when the deck runs out', () => {
    expect(tenone.config.defaults(5).start).toBe(10);
    expect(tenone.config.defaults(6).start).toBe(8);
    expect(tenone.config.defaults(7).start).toBe(7);
  });

  it('marks the 1-card hand as a forehead round only when that option is on', () => {
    expect(tenone.roundInfo(ctx(9)).forehead).toBe(false);
    expect(tenone.roundInfo(ctx(9, cfg({ foreheadOnOne: true }))).forehead).toBe(true);
    expect(tenone.roundInfo(ctx(8, cfg({ foreheadOnOne: true }))).forehead).toBe(false);
    expect(tenone.roundInfo(ctx(3))).toMatchObject({ cards: 7, of: 10, firstBidder: 4 });
  });
});

describe('10-1 validation', () => {
  it('applies the dealer hook', () => {
    expect(msgs(0, { bids: [2, 1, 2, 2, 0] })).toEqual([
      "The bids can't add up to 7: the dealer has to change theirs",
    ]);
    expect(msgs(0, { bids: [2, 1, 2, 0, 1] })).toEqual([]);
    expect(msgs(0, { bids: [2, 1, 2, 2, 0] }, ctx(3, cfg({ hook: false })))).toEqual([]);
  });

  it('needs every bid, and tricks that add up to the hand', () => {
    expect(msgs(0, { bids: [1, 1] })).toEqual(['Everyone needs a bid']);
    expect(msgs(1, { bids: [2, 1, 2, 0, 1], tricks: [2, 1, 2, 0, 1] })).toEqual(['Tricks add up to 6, not 7']);
    expect(msgs(1, { bids: [2, 1, 2, 0, 1], tricks: [3, 1, 2, 0, 1] })).toEqual([]);
  });
});

describe('10-1 scoring', () => {
  it('scores 10 + bid for an exact bid and 0 for a miss', () => {
    expect(tenone.score({ bids: [2, 1, 2, 0, 1], tricks: [3, 1, 2, 0, 1] }, ctx(3))).toEqual([0, 11, 12, 10, 11]);
  });

  it('can score 1 per trick plus 10 for an exact bid', () => {
    const c = ctx(3, cfg({ scoring: 'tricks-plus-ten' }));
    expect(tenone.score({ bids: [2, 1, 2, 0, 1], tricks: [3, 1, 2, 0, 1] }, c)).toEqual([3, 11, 12, 10, 11]);
  });

  it('plays to the last hand and the highest total wins', () => {
    const config = cfg({ start: 3 }, 3);
    const r = (n: number, bids: number[], tricks: number[]) => ({ n, phase: 'tricks', entry: { bids, tricks } });
    const game: StoredGame<TenoneConfig, TenoneEntry> = {
      config,
      seats: 3,
      firstDealer: 0,
      rounds: [r(0, [1, 1, 0], [1, 1, 1]), r(1, [1, 0, 0], [1, 0, 1]), r(2, [0, 0, 0], [1, 0, 0])],
    };
    const v = replay(tenone, game);
    expect(v.over).toBe(true);
    expect(v.totals).toEqual([22, 31, 10]);
    expect(v.winners).toEqual([1]);
  });
});
