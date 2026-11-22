import type { GameUi } from '@cards/ui';
import BidsEditor from './BidsEditor.vue';
import TricksEditor from './TricksEditor.vue';
import TenoneCell from './TenoneCell.vue';

const ui: GameUi = {
  glyph: '10',
  ink: 'blue',
  accent: '--tenone',
  blurb: 'Bid your tricks exactly, from 10 cards down to 1.',
  editors: { bids: BidsEditor, tricks: TricksEditor },
  cell: TenoneCell,
  startEntry: (phase, seats, saved) => {
    const bids = (saved?.bids as number[] | undefined) ?? new Array(seats).fill(null);
    if (phase === 'bids') return { bids };
    return { bids, tricks: (saved?.tricks as number[] | undefined) ?? [...bids] };
  },
  configFields: [
    { key: 'start', label: 'First hand', hint: 'Cards dealt in round 1', kind: 'number', min: 3, max: 10 },
    { key: 'upAgain', label: 'Back up to the start', hint: '10 → 1 → 10', kind: 'toggle' },
    {
      key: 'scoring',
      label: 'Scoring',
      kind: 'choice',
      options: [
        { value: 'ten-plus-bid', label: 'Exact: 10 + bid, miss: 0' },
        { value: 'tricks-plus-ten', label: '1 per trick, +10 if exact' },
      ],
    },
    { key: 'hook', label: 'Dealer hook', hint: "Bids can't add up to the cards dealt", kind: 'toggle' },
    {
      key: 'foreheadOnOne',
      label: 'Newfie poker on the 1-card hand',
      hint: 'Card on your forehead, bid without looking',
      kind: 'toggle',
    },
  ],
  roundLabel: (info, dealer) =>
    `${info.cards} ${info.cards === 1 ? 'card' : 'cards'}${info.forehead ? ' on foreheads' : ''} · ${dealer} deals`,
};

export default ui;
