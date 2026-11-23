<script setup lang="ts">
import { computed } from 'vue';
import type { CardFace } from '../game-ui';
import { SUIT_PATHS } from '../suits';

// One playing card drawn in SVG (no font glyphs, so phones never swap in emoji).
// Number cards get real pip layouts, the ace one large pip, the queen and king a drawn bust.
const props = defineProps<{ card: CardFace }>();

const PATHS = SUIT_PATHS;

const red = computed(() => props.card.suit === 'hearts' || props.card.suit === 'diamonds');
const suit = computed(() => PATHS[props.card.suit]);
const label = computed(() => {
  const ranks: Record<string, string> = { A: 'Ace', Q: 'Queen', K: 'King' };
  return `${ranks[props.card.rank] ?? props.card.rank} of ${props.card.suit}`;
});

// Pip centres as fractions of the pip box (x: 0 left, .5 middle, 1 right; y: 0 top … 1 bottom).
const L = 0, M = 0.5, R = 1;
const LAYOUTS: Record<string, [number, number][]> = {
  '2': [[M, 0], [M, 1]],
  '3': [[M, 0], [M, 0.5], [M, 1]],
  '4': [[L, 0], [R, 0], [L, 1], [R, 1]],
  '5': [[L, 0], [R, 0], [M, 0.5], [L, 1], [R, 1]],
  '6': [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '7': [[L, 0], [R, 0], [M, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  '8': [[L, 0], [R, 0], [M, 0.25], [L, 0.5], [R, 0.5], [M, 0.75], [L, 1], [R, 1]],
  '9': [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [M, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  '10': [[L, 0], [R, 0], [M, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [M, 5 / 6], [L, 1], [R, 1]],
};
// Pip box inside the 66 × 92 card.
const BOX = { x: 19, y: 17, w: 28, h: 58 };
const pips = computed(() =>
  (LAYOUTS[props.card.rank] ?? []).map(([fx, fy]) => ({
    x: BOX.x + fx * BOX.w,
    y: BOX.y + fy * BOX.h,
    flip: fy > 0.5,
  })),
);
const face = computed(() => (props.card.rank === 'Q' || props.card.rank === 'K' ? props.card.rank : undefined));
</script>

<template>
  <svg class="pc" :class="{ red }" viewBox="0 0 66 92" role="img" :aria-label="label">
    <rect x=".5" y=".5" width="65" height="91" rx="6.5" class="face" />
    <!-- corner indices -->
    <g class="ix">
      <text x="8" y="14" text-anchor="middle">{{ card.rank }}</text>
      <path :d="suit" transform="translate(4.5 17) scale(.7)" />
    </g>
    <g class="ix" transform="rotate(180 33 46)">
      <text x="8" y="14" text-anchor="middle">{{ card.rank }}</text>
      <path :d="suit" transform="translate(4.5 17) scale(.7)" />
    </g>

    <!-- ace: one large suit -->
    <path v-if="card.rank === 'A'" :d="suit" transform="translate(19 31) scale(2.8)" />

    <!-- number cards: pips -->
    <path
      v-for="(p, i) in pips"
      :key="i"
      :d="suit"
      :transform="`translate(${p.x} ${p.y}) ${p.flip ? 'rotate(180)' : ''} scale(.82) translate(-5 -5)`"
    />

    <!-- court cards: framed bust -->
    <g v-if="face" class="court" transform="translate(14 16)">
      <rect x="0" y="0" width="38" height="60" rx="2" class="frame" />
      <clipPath :id="`clip-${card.rank}-${card.suit}`"><rect x="0" y="0" width="38" height="60" rx="2" /></clipPath>
      <g :clip-path="`url(#clip-${card.rank}-${card.suit})`">
        <rect x="0" y="0" width="38" height="60" class="sky" />
        <template v-if="face === 'Q'">
          <!-- hair falling behind the shoulders -->
          <path d="M10 22C9 32 8 40 6 48H32C30 40 29 32 28 22Z" class="hair" />
          <!-- robe -->
          <path d="M2 62C3 50 7 44 19 43 31 44 35 50 36 62Z" class="robe" />
          <path d="M12 44 19 54 26 44" class="trim" />
          <path d="M19 54V62" class="trim" />
          <!-- neck and face -->
          <rect x="16.5" y="34" width="5" height="9" class="skin" />
          <ellipse cx="19" cy="28" rx="7" ry="8.4" class="skin" />
          <path d="M11.8 27C12 20 15 18 19 18 23 18 26 20 26.2 27 24.5 23.5 22 22 19 22 16 22 13.5 23.5 11.8 27Z" class="hair" />
          <circle cx="16.4" cy="28" r=".9" class="ink" />
          <circle cx="21.6" cy="28" r=".9" class="ink" />
          <path d="M17.2 32.6Q19 33.8 20.8 32.6" class="lips" />
          <!-- crown -->
          <path d="M12.5 19 12 11 15.2 14.6 19 9 22.8 14.6 26 11 25.5 19Z" class="gold" />
          <circle cx="12" cy="11" r="1.1" class="gem" />
          <circle cx="19" cy="9" r="1.2" class="gem" />
          <circle cx="26" cy="11" r="1.1" class="gem" />
          <!-- the rose every queen holds -->
          <path d="M29 58 31 47" class="stem" />
          <circle cx="31.4" cy="46" r="2.6" class="rose" />
        </template>
        <template v-else>
          <!-- robe with ermine collar -->
          <path d="M1 62C2 50 6 44 19 43 32 44 36 50 37 62Z" class="robe" />
          <path d="M8 46C12 50 26 50 30 46 28 44 24 43 19 43 14 43 10 44 8 46Z" class="ermine" />
          <!-- face, beard -->
          <rect x="16.5" y="34" width="5" height="8" class="skin" />
          <ellipse cx="19" cy="27.5" rx="7" ry="8" class="skin" />
          <path d="M12 27C12 35 15 41 19 42 23 41 26 35 26 27 25 31 23 33 19 33 15 33 13 31 12 27Z" class="beard" />
          <path d="M15.5 31.5Q19 29.8 22.5 31.5" class="beard-line" />
          <circle cx="16.4" cy="26.6" r=".9" class="ink" />
          <circle cx="21.6" cy="26.6" r=".9" class="ink" />
          <!-- crown with a cross -->
          <path d="M11.5 20 11.5 12 14.5 15 17 10.5 19 13.5 21 10.5 23.5 15 26.5 12 26.5 20Z" class="gold" />
          <path d="M19 6.5V10.5M17.4 8H20.6" class="cross" />
          <rect x="11.5" y="18" width="15" height="2.4" class="band" />
          <!-- sword -->
          <path d="M33.5 60V40" class="blade" />
          <path d="M31 41.5H36" class="hilt" />
        </template>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.pc { display: block; width: 100%; height: 100%; color: var(--card-ink); --suit: var(--card-ink); }
.pc.red { --suit: var(--card-red); }
.face { fill: var(--card-face); stroke: var(--card-edge); stroke-width: 1; }
.ix text { font: 700 12.5px var(--f-num); fill: var(--suit); }
.pc > path, .ix path { fill: var(--suit); }

/* The court figures use fixed card colors in both themes: real cards don't change at night. */
.frame { fill: none; stroke: var(--court-ink); stroke-width: .8; }
.sky { fill: var(--court-sky); }
.robe { fill: var(--robe, var(--court-blue)); }
.red .robe { --robe: var(--court-red); }
.trim { fill: none; stroke: var(--court-gold); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.skin { fill: var(--court-skin); }
.hair { fill: var(--court-hair); }
.ink { fill: var(--court-ink); }
.lips { fill: none; stroke: var(--court-red); stroke-width: .9; stroke-linecap: round; }
.gold { fill: var(--court-gold); stroke: var(--court-gold-dark); stroke-width: .5; stroke-linejoin: round; }
.gem { fill: var(--court-red); }
.red .gem { fill: var(--court-blue); }
.stem { stroke: var(--court-green); stroke-width: 1.2; stroke-linecap: round; }
.rose { fill: var(--court-red); stroke: var(--court-red-dark); stroke-width: .6; }
.ermine { fill: var(--court-ermine); stroke: var(--court-ink); stroke-width: .5; stroke-dasharray: .6 2.4; }
.beard { fill: var(--court-beard); }
.beard-line { fill: none; stroke: var(--court-beard-dark); stroke-width: .9; stroke-linecap: round; }
.cross { stroke: var(--court-gold); stroke-width: 1.4; stroke-linecap: round; }
.band { fill: var(--court-gold-dark); }
.blade { stroke: var(--court-steel); stroke-width: 1.8; stroke-linecap: round; }
.hilt { stroke: var(--court-gold-dark); stroke-width: 1.8; stroke-linecap: round; }
</style>
