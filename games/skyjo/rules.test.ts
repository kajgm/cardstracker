import { describe, expect, it } from 'vitest';
import { replay, type StoredGame } from '@cards/engine';
import skyjo, { type SkyjoConfig, type SkyjoEntry } from './rules';

const cfg = (over: Partial<SkyjoConfig> = {}): SkyjoConfig => ({ ...skyjo.config.defaults(3), ...over });
const ctx = (config = cfg()) => ({ config, seats: 3, round: 0, dealer: 0, history: [] });
const result = (e: Partial<SkyjoEntry>) => skyjo.phases[0].validate(e, ctx()).map((i) => i.message);

describe('skyjo scoring', () => {
  it('scores card totals when the player who went out is lowest', () => {
    expect(skyjo.score({ cards: [3, 10, 20], out: 0 }, ctx())).toEqual([3, 10, 20]);
  });

  it('doubles the player who went out unless strictly lowest', () => {
    expect(skyjo.score({ cards: [12, 10, 20], out: 0 }, ctx())).toEqual([24, 10, 20]);
    expect(skyjo.score({ cards: [10, 10, 20], out: 0 }, ctx())).toEqual([20, 10, 20]);
  });

  it('never doubles a zero or negative total', () => {
    expect(skyjo.score({ cards: [-2, -5, 20], out: 0 }, ctx())).toEqual([-2, -5, 20]);
    expect(skyjo.score({ cards: [0, 0, 20], out: 0 }, ctx())).toEqual([0, 0, 20]);
  });
});

describe('skyjo validation', () => {
  it('needs who went out and every total', () => {
    expect(result({ cards: [1, null, 3] as unknown as number[] })).toEqual([
      'Choose who went out',
      'Enter a total for every player',
    ]);
    expect(result({ cards: [1, 2, 3], out: 1 })).toEqual([]);
  });
});

describe('skyjo flow', () => {
  it('ends at the target and the lowest total wins', () => {
    const game: StoredGame<SkyjoConfig, SkyjoEntry> = {
      config: cfg({ target: 50 }),
      seats: 3,
      firstDealer: 0,
      rounds: [
        { n: 0, phase: 'result', entry: { cards: [5, 30, 20], out: 0 } },
        { n: 1, phase: 'result', entry: { cards: [15, 10, 20], out: 0 } },
      ],
    };
    const v = replay(skyjo, game);
    expect(v.totals).toEqual([35, 40, 40]);
    expect(v.over).toBe(false);
    game.rounds.push({ n: 2, phase: 'result', entry: { cards: [1, 12, 2], out: 2 } });
    const end = replay(skyjo, game);
    expect(end.totals).toEqual([36, 52, 44]);
    expect(end.over).toBe(true);
    expect(end.winners).toEqual([0]);
  });
});
