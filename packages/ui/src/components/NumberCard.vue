<script setup lang="ts">
import { computed } from 'vue';

// A numbered card (Skyjo-style, −2…12) in the same 66 × 92 box as PlayingCard,
// its face colored by value band like the real deck.
const props = defineProps<{ value: number }>();
const band = computed(() => {
  const v = props.value;
  return v < 0 ? 'neg' : v === 0 ? 'zero' : v <= 4 ? 'low' : v <= 8 ? 'mid' : 'high';
});
const text = computed(() => (props.value < 0 ? `−${-props.value}` : String(props.value)));
</script>

<template>
  <svg class="nc" :class="band" viewBox="0 0 66 92" role="img" :aria-label="`Card ${value}`">
    <rect x=".5" y=".5" width="65" height="91" rx="6.5" class="edge" />
    <rect x="5" y="5" width="56" height="82" rx="4" class="face" />
    <text x="11" y="17" text-anchor="middle" class="ix">{{ text }}</text>
    <text x="11" y="17" text-anchor="middle" class="ix" transform="rotate(180 33 46)">{{ text }}</text>
    <text x="33" y="56" text-anchor="middle" class="big">{{ text }}</text>
  </svg>
</template>

<style scoped>
/* Fixed card colors in both themes: real cards don't change at night. */
.nc { display: block; width: 100%; height: 100%; }
.edge { fill: var(--card-face); stroke: var(--card-edge); stroke-width: 1; }
.face { fill: var(--band); }
.neg { --band: var(--num-neg); }
.zero { --band: var(--num-zero); }
.low { --band: var(--num-low); }
.mid { --band: var(--num-mid); }
.high { --band: var(--num-high); }
text { fill: #fff; stroke: var(--court-ink); stroke-width: 1.2; paint-order: stroke; font-family: var(--f-num); font-weight: 700; }
.ix { font-size: 11px; stroke-width: .8; }
.big { font-size: 30px; }
</style>
