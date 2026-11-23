import type { GameUi } from '@cards/ui';
import ResultEditor from './ResultEditor.vue';
import HeartsCell from './HeartsCell.vue';
import { moonShooter, type HeartsEntry } from '../rules';

const PASS_LABEL: Record<string, string> = {
  left: 'Pass left',
  right: 'Pass right',
  across: 'Pass across',
  keep: 'Keep your cards',
};

const ui: GameUi = {
  glyph: '♥',
  ink: 'red',
  accent: '--hearts',
  blurb: 'Dodge the hearts and the queen of spades. Lowest score wins.',
  hand: {
    layout: 'fan',
    cards: [
      { rank: '7', suit: 'hearts' },
      { rank: 'Q', suit: 'spades' },
      { rank: 'A', suit: 'hearts' },
      { rank: 'K', suit: 'hearts' },
    ],
  },
  facts: ['to 100', 'Lowest wins'],
  about:
    'Pass three cards, then try not to win any hearts or the queen of spades. Each heart costs a point and the queen costs 13. Take every heart and the queen in one hand and you shoot the moon: everyone else takes 26, or you take 26 off your own score. The game ends when someone reaches 100, and the lowest score wins.',
  legend: '♛ took the queen of spades. ☾ shot the moon.',
  flourish: (entry, players) => {
    const seat = moonShooter(entry as Partial<HeartsEntry>);
    const name = players.find((p) => p.seat === seat)?.name;
    return name ? { glyph: '☾', text: `${name} shot the moon` } : undefined;
  },
  editors: { result: ResultEditor },
  cell: HeartsCell,
  startEntry: (_phase, seats, saved) => saved ?? { hearts: new Array(seats).fill(0) },
  configFields: [
    { key: 'target', label: 'Play to', kind: 'number', min: 25, max: 500, step: 25 },
    {
      key: 'moon',
      label: 'Shooting the moon',
      kind: 'choice',
      options: [
        { value: 'choose', label: 'Shooter chooses' },
        { value: 'others+26', label: '+26 to everyone else' },
        { value: 'self-26', label: '−26 for the shooter' },
      ],
    },
  ],
  roundLabel: (info, dealer) => `${PASS_LABEL[String(info.pass)] ?? ''}, ${dealer} deals`,
};

export default ui;
