import type { GameUi } from '@cards/ui';
import ResultEditor from './ResultEditor.vue';
import HeartsCell from './HeartsCell.vue';

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
  roundLabel: (info, dealer) => `${PASS_LABEL[String(info.pass)] ?? ''} · ${dealer} deals`,
};

export default ui;
