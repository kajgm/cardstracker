/** Suit shapes in a 10 × 10 box, drawn as SVG so phones never swap in emoji. */
const HEART = 'M5 9C5 9 0 5.6 0 2.9 0 1.3 1.2 0 2.6 0 3.7 0 4.5.7 5 1.6 5.5.7 6.3 0 7.4 0 8.8 0 10 1.3 10 2.9 10 5.6 5 9 5 9Z';
const SPADE =
  'M5 0C5 0 0 3.6 0 6 0 7.4 1.1 8.4 2.4 8.4 3.3 8.4 4 8 4.4 7.4 4.3 8.6 3.8 9.4 3 10H7C6.2 9.4 5.7 8.6 5.6 7.4 6 8 6.7 8.4 7.6 8.4 8.9 8.4 10 7.4 10 6 10 3.6 5 0 5 0Z';
const DIAMOND = 'M5 0 9.5 5 5 10 .5 5Z';
const CLUB =
  'M5 0C3.6 0 2.6 1.1 2.6 2.4 2.6 3 2.8 3.5 3.1 3.9 2.8 3.8 2.6 3.8 2.4 3.8 1.1 3.8 0 4.9 0 6.2 0 7.5 1.1 8.6 2.4 8.6 3.3 8.6 4 8.2 4.4 7.5 4.3 8.7 3.8 9.4 3 10H7C6.2 9.4 5.7 8.7 5.6 7.5 6 8.2 6.7 8.6 7.6 8.6 8.9 8.6 10 7.5 10 6.2 10 4.9 8.9 3.8 7.6 3.8 7.4 3.8 7.2 3.8 6.9 3.9 7.2 3.5 7.4 3 7.4 2.4 7.4 1.1 6.4 0 5 0Z';
export const SUIT_PATHS = { hearts: HEART, spades: SPADE, diamonds: DIAMOND, clubs: CLUB } as const;
export type Suit = keyof typeof SUIT_PATHS;
