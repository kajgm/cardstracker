import type { GameUi } from '@cards/ui';
import BidsEditor from './BidsEditor.vue';
import TricksEditor from './TricksEditor.vue';
import TenoneCell from './TenoneCell.vue';

const ui: GameUi = {
  glyph: '10',
  ink: 'blue',
  accent: '--tenone',
  blurb: "Ten hands, from ten cards down to one. Bid exactly what you'll take.",
  hand: {
    layout: 'stair',
    cards: [
      { rank: '10', suit: 'spades' },
      { rank: '9', suit: 'spades' },
      { rank: '8', suit: 'spades' },
      { rank: 'A', suit: 'spades' },
    ],
  },
  facts: ['10 hands', 'Highest wins', 'Dealer hook'],
  about:
    "The first hand deals ten cards, the next nine, and so on down to one. Before each hand, everyone bids how many tricks they'll take. Make your bid exactly and you score 10 plus your bid; miss by any amount and you score nothing. The dealer bids last and can't make the bids add up to the cards dealt, so somebody always misses. With Newfie poker on, the one-card hand is played with your card on your forehead.",
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
    `${info.cards} ${info.cards === 1 ? 'card' : 'cards'}${info.forehead ? ' on foreheads' : ''}, ${dealer} deals`,
};

export default ui;
