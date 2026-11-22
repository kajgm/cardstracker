import { z } from 'zod';
import { defineGame, issues, rateStat, sum, type RoundCtx } from '@cards/engine';

export const tenoneConfig = z.object({
  /** Cards in the first hand; defaults to 10, fewer when the deck can't stretch. */
  start: z.number().int().min(3).max(10),
  /** 10 → 1 → 10 instead of stopping at 1. */
  upAgain: z.boolean().default(false),
  /** Exact bid scores 10 + bid, a miss 0; or 1 per trick plus 10 for an exact bid. */
  scoring: z.enum(['ten-plus-bid', 'tricks-plus-ten']).default('ten-plus-bid'),
  /** The dealer can't make the bids add up to the cards dealt. */
  hook: z.boolean().default(true),
  /**
   * Newfie poker on the 1-card hand: everyone holds their card to their
   * forehead without looking and bids from the cards they can see.
   */
  foreheadOnOne: z.boolean().default(false),
});
export type TenoneConfig = z.infer<typeof tenoneConfig>;

export interface TenoneEntry {
  bids: number[];
  /** Filled in by the second phase. */
  tricks?: number[];
}

const entry = z.object({
  bids: z.array(z.number().int().min(0).max(10)).optional(),
  tricks: z.array(z.number().int().min(0).max(10)).optional(),
});

/** Round 0 deals `start` cards, counting down to 1, then back up to `start` with upAgain. */
export function handSize(round: number, start: number): number {
  return round < start ? start - round : round - start + 2;
}

export function totalRounds(config: Pick<TenoneConfig, 'start' | 'upAgain'>): number {
  return config.upAgain ? 2 * config.start - 1 : config.start;
}

const cards = (ctx: RoundCtx<TenoneConfig>) => handSize(ctx.round, ctx.config.start);
/** Editors hold null for "not entered yet"; only real numbers count. */
const filled = (values: (number | null | undefined)[] | undefined) =>
  (values ?? []).filter((v) => typeof v === 'number').length;

export default defineGame<TenoneConfig, TenoneEntry>({
  id: 'tenone',
  name: '10-1',
  players: { min: 3, max: 7 },
  lowWins: false,
  config: {
    schema: tenoneConfig,
    // 52 cards less one for trump: 6 players start at 8, 7 at 7.
    defaults: (seats) => tenoneConfig.parse({ start: Math.min(10, Math.floor(51 / seats)) }),
  },
  entry,
  phases: [
    {
      id: 'bids',
      label: 'Bids',
      validate: (e, ctx) =>
        issues(
          (filled(e.bids) !== ctx.seats || e.bids?.length !== ctx.seats) && 'Everyone needs a bid',
          (e.bids ?? []).some((b) => b > cards(ctx)) && `Nobody can bid more than ${cards(ctx)}`,
          ctx.config.hook &&
            filled(e.bids) === ctx.seats &&
            sum(e.bids) === cards(ctx) &&
            `The bids can't add up to ${cards(ctx)}: the dealer has to change theirs`,
        ),
    },
    {
      id: 'tricks',
      label: 'Tricks taken',
      validate: (e, ctx) =>
        issues(
          (filled(e.tricks) !== ctx.seats || e.tricks?.length !== ctx.seats) && 'Enter tricks for every player',
          sum(e.tricks) !== cards(ctx) && `Tricks add up to ${sum(e.tricks)}, not ${cards(ctx)}`,
        ),
    },
  ],
  roundInfo: (ctx) => ({
    cards: cards(ctx),
    of: totalRounds(ctx.config),
    firstBidder: (ctx.dealer + 1) % ctx.seats,
    forehead: ctx.config.foreheadOnOne && cards(ctx) === 1,
  }),
  score: ({ bids, tricks = [] }, { config }) =>
    bids.map((bid, seat) => {
      const made = tricks[seat] === bid;
      return config.scoring === 'ten-plus-bid' ? (made ? 10 + bid : 0) : tricks[seat] + (made ? 10 : 0);
    }),
  isOver: ({ roundsPlayed, config }) => roundsPlayed === totalRounds(config),
  stats: [rateStat('Bid accuracy', (e, seat) => e.tricks?.[seat] === e.bids[seat])],
});
