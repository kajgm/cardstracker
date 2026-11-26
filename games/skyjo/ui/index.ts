import type { GameUi } from '@cards/ui';
import ResultEditor from './ResultEditor.vue';
import SkyjoCell from './SkyjoCell.vue';
import { doubled, type SkyjoEntry } from '../rules';

const ui: GameUi = {
  glyph: '12',
  ink: 'red',
  accent: '--skyjo',
  blurb: 'Flip and swap your way to the lowest card total. Go out early at your own risk.',
  hand: { layout: 'fan', cards: [{ value: -2 }, { value: 0 }, { value: 7 }, { value: 12 }] },
  facts: ['to 100', 'Lowest wins'],
  about:
    'Everyone has twelve face-down cards worth −2 to 12. On your turn, draw and swap one in, or turn one over. Three of a kind in a column clears it. When someone has turned over all their cards, everyone else takes one last turn and the round is scored: the total of your cards. Whoever went out scores double unless they have the lowest total. The game ends when someone reaches 100, and the lowest score wins.',
  legend: '✓ went out. ×2 went out and was doubled.',
  flourish: (entry, players) => {
    const e = entry as unknown as SkyjoEntry;
    if (!doubled(e)) return undefined;
    const name = players.find((p) => p.seat === e.out)?.name;
    return name ? { glyph: '×2', text: `${name} went out too soon` } : undefined;
  },
  editors: { result: ResultEditor },
  cell: SkyjoCell,
  startEntry: (_phase, seats, saved) => saved ?? { cards: new Array(seats).fill(null) },
  configFields: [{ key: 'target', label: 'Play to', kind: 'number', min: 25, max: 500, step: 25 }],
  roundLabel: (_info, dealer) => `${dealer} deals`,
};

export default ui;
