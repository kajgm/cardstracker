import { z } from 'zod';
import { countStat, defineGame, issues, sum, type Seat } from '@cards/engine';

const PASS_4 = ['left', 'right', 'across', 'keep'] as const;
const PASS_OTHER = ['left', 'right', 'keep'] as const;

export type MoonScoring = 'others+26' | 'self-26';

export const heartsConfig = z.object({
  /** The game ends when someone reaches this. */
  target: z.number().int().min(25).max(500).default(100),
  /** 'choose': the shooter picks +26 to everyone else or −26 to themselves. */
  moon: z.enum(['choose', 'others+26', 'self-26']).default('choose'),
});
export type HeartsConfig = z.infer<typeof heartsConfig>;

export interface HeartsEntry {
  /** Seat that took the queen of spades. */
  queen: Seat;
  /** Hearts taken, per seat. */
  hearts: number[];
  /** How a moon scores, when the shooter chooses. */
  moon?: MoonScoring;
}

const entry = z.object({
  queen: z.number().int().min(0).optional(),
  hearts: z.array(z.number().int().min(0).max(13)).optional(),
  moon: z.enum(['others+26', 'self-26']).optional(),
});

/** Seat that took all 13 hearts and the queen of spades, or -1. */
export function moonShooter(e: Partial<HeartsEntry>): Seat {
  return (e.hearts ?? []).findIndex((h, seat) => h === 13 && seat === e.queen);
}

export const passDirection = (round: number, seats: number) => {
  const cycle = seats === 4 ? PASS_4 : PASS_OTHER;
  return cycle[round % cycle.length];
};

export default defineGame<HeartsConfig, HeartsEntry>({
  id: 'hearts',
  name: 'Hearts',
  players: { min: 3, max: 6 },
  lowWins: true,
  config: { schema: heartsConfig, defaults: () => heartsConfig.parse({}) },
  entry,
  phases: [
    {
      id: 'result',
      label: 'Round result',
      validate: (e, { seats, config }) => {
        const shooter = moonShooter(e);
        return issues(
          e.queen === undefined && 'Choose who took the queen of spades',
          e.queen !== undefined && e.queen >= seats && 'That seat is not at the table',
          (e.hearts?.length ?? 0) !== seats && 'Enter hearts for every player',
          sum(e.hearts) !== 13 && `Hearts add up to ${sum(e.hearts)}, not 13`,
          shooter >= 0 && config.moon === 'choose' && !e.moon && 'Choose how the moon scores',
        );
      },
    },
  ],
  roundInfo: ({ round, seats }) => ({ pass: passDirection(round, seats) }),
  score: (e, { config }) => {
    const pts = e.hearts.map((h, seat) => h + (seat === e.queen ? 13 : 0));
    const shooter = moonShooter(e);
    if (shooter >= 0) {
      const mode = config.moon === 'choose' ? e.moon : config.moon;
      // The shooter's own hearts and queen don't count against them.
      pts[shooter] -= 26;
      if (mode === 'self-26') pts[shooter] -= 26;
      else pts.forEach((_, seat) => seat !== shooter && (pts[seat] += 26));
    }
    return pts;
  },
  isOver: ({ totals, config }) => Math.max(...totals) >= config.target,
  stats: [
    countStat('Moons shot', (e) => moonShooter(e)),
    countStat('Took the queen of spades', (e) => e.queen),
  ],
});
