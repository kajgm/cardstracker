import { describe, expect, it } from 'vitest';
import { checkSave, replay, type StoredGame } from '@cards/engine';
import hearts, { passDirection, type HeartsConfig, type HeartsEntry } from './rules';

const cfg = (over: Partial<HeartsConfig> = {}): HeartsConfig => ({ ...hearts.config.defaults(4), ...over });
const ctx = (config = cfg(), round = 0) => ({ config, seats: 4, round, dealer: 0, history: [] });
const result = (e: Partial<HeartsEntry>, config = cfg()) => hearts.phases[0].validate(e, ctx(config));

describe('hearts scoring', () => {
  it('counts hearts plus 13 for the queen', () => {
    expect(hearts.score({ queen: 1, hearts: [3, 4, 2, 4] }, ctx())).toEqual([3, 17, 2, 4]);
  });

  it('lets the shooter choose +26 to everyone else', () => {
    expect(hearts.score({ queen: 3, hearts: [0, 0, 0, 13], moon: 'others+26' }, ctx())).toEqual([26, 26, 26, 0]);
  });

  it('lets the shooter choose −26 for themselves', () => {
    expect(hearts.score({ queen: 3, hearts: [0, 0, 0, 13], moon: 'self-26' }, ctx())).toEqual([0, 0, 0, -26]);
  });

  it('applies a fixed moon rule without asking', () => {
    const config = cfg({ moon: 'self-26' });
    expect(result({ queen: 0, hearts: [13, 0, 0, 0] }, config)).toEqual([]);
    expect(hearts.score({ queen: 0, hearts: [13, 0, 0, 0] }, ctx(config))).toEqual([-26, 0, 0, 0]);
  });

  it('ignores a jack of diamonds left in an old config or entry', () => {
    const config = hearts.config.schema.parse({ target: 100, moon: 'choose', jackMinus10: true }) as HeartsConfig;
    expect(config).toEqual({ target: 100, moon: 'choose' });
    const e = { queen: 0, hearts: [1, 2, 4, 6], jack: 2 } as HeartsEntry;
    expect(hearts.score(e, ctx(config))).toEqual([14, 2, 4, 6]);
  });
});

describe('hearts validation', () => {
  it('needs the queen and 13 hearts', () => {
    expect(result({ hearts: [3, 3, 3, 3] }).map((i) => i.message)).toEqual([
      'Choose who took the queen of spades',
      'Hearts add up to 12, not 13',
    ]);
    expect(result({ queen: 2, hearts: [3, 3, 3, 4] })).toEqual([]);
  });

  it('asks how the moon scores when the shooter chooses', () => {
    expect(result({ queen: 1, hearts: [0, 13, 0, 0] }).map((i) => i.message)).toEqual([
      'Choose how the moon scores',
    ]);
    expect(result({ queen: 1, hearts: [0, 13, 0, 0], moon: 'self-26' })).toEqual([]);
  });
});

describe('hearts flow', () => {
  it('passes left, right, across, keep with four players and skips across otherwise', () => {
    expect([0, 1, 2, 3, 4].map((r) => passDirection(r, 4))).toEqual(['left', 'right', 'across', 'keep', 'left']);
    expect([0, 1, 2, 3].map((r) => passDirection(r, 5))).toEqual(['left', 'right', 'keep', 'left']);
  });

  it('ends at the target, lowest wins, and a tie shares the win', () => {
    const round = (n: number, h: number[], queen: number) => ({ n, phase: 'result', entry: { queen, hearts: h } });
    const game: StoredGame<HeartsConfig, HeartsEntry> = {
      config: cfg({ target: 30 }),
      seats: 4,
      firstDealer: 0,
      rounds: [round(0, [0, 0, 4, 9], 3), round(1, [0, 0, 9, 4], 2), round(2, [5, 5, 3, 0], 0)],
    };
    const v = replay(hearts, game);
    expect(v.totals).toEqual([18, 5, 29, 26]);
    expect(v.over).toBe(false);
    game.rounds.push(round(3, [0, 0, 4, 9], 0));
    const end = replay(hearts, game);
    expect(end.totals).toEqual([31, 5, 33, 35]);
    expect(end.over).toBe(true);
    expect(end.winners).toEqual([1]);

    const tied = replay(hearts, {
      ...game,
      config: cfg({ target: 25 }),
      rounds: [round(0, [0, 4, 4, 5], 0), round(1, [0, 4, 4, 5], 0)],
    });
    expect(tied.totals).toEqual([26, 8, 8, 10]);
    expect(tied.winners).toEqual([1, 2]);
    expect(tied.standings.filter((s) => s.place === 1)).toHaveLength(2);
  });

  it('refuses a save with the wrong total', () => {
    const game: StoredGame<HeartsConfig, HeartsEntry> = { config: cfg(), seats: 4, firstDealer: 0, rounds: [] };
    const check = checkSave(hearts, game, { n: 0, phase: 'result', entry: { queen: 0, hearts: [1, 1, 1, 1] } });
    expect(check.ok).toBe(false);
  });
});
