import { z } from 'zod';
import { countStat, defineGame, issues, type Seat } from '@cards/engine';

export const skyjoConfig = z.object({
  /** The game ends when someone reaches this. */
  target: z.number().int().min(25).max(500).default(100),
});
export type SkyjoConfig = z.infer<typeof skyjoConfig>;

export interface SkyjoEntry {
  /** Face-up card total per seat, after any cleared columns. */
  cards: number[];
  /** Seat that turned over all their cards first. */
  out: Seat;
}

// 12 cards from −2 to 12: −17 at best, 144 at worst.
const entry = z.object({
  cards: z.array(z.number().int().min(-17).max(144)).optional(),
  out: z.number().int().min(0).optional(),
});

/** Whoever went out pays double unless they have the strictly lowest total (only when it's positive). */
export function doubled(e: Pick<SkyjoEntry, 'cards' | 'out'>): boolean {
  const mine = e.cards[e.out];
  return mine > 0 && e.cards.some((c, seat) => seat !== e.out && c <= mine);
}

export default defineGame<SkyjoConfig, SkyjoEntry>({
  id: 'skyjo',
  name: 'Skyjo',
  players: { min: 2, max: 8 },
  lowWins: true,
  config: { schema: skyjoConfig, defaults: () => skyjoConfig.parse({}) },
  entry,
  phases: [
    {
      id: 'result',
      label: 'Round result',
      validate: (e, { seats }) =>
        issues(
          e.out === undefined && 'Choose who went out',
          e.out !== undefined && e.out >= seats && 'That seat is not at the table',
          (e.cards?.length !== seats || e.cards.some((c) => typeof c !== 'number')) && 'Enter a total for every player',
        ),
    },
  ],
  roundInfo: () => ({}),
  score: (e) => e.cards.map((c, seat) => (seat === e.out && doubled(e) ? 2 * c : c)),
  isOver: ({ totals, config }) => Math.max(...totals) >= config.target,
  stats: [
    countStat('Went out', (e) => e.out),
    countStat('Doubled', (e) => (doubled(e) ? e.out : -1)),
  ],
});
