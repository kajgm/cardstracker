<script setup lang="ts">

// Baize with a slow lamp light drifting over faint, drifting suits.
// Only transforms and opacity animate, so phones composite it cheaply; still with reduced motion.
withDefaults(defineProps<{ tag?: string }>(), { tag: 'div' });
</script>

<script lang="ts">
import { SUIT_PATHS } from '../suits';

const tile =
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>` +
  (
    [
      ['spades', 8, 10, 1.4, 'rgba(255,255,255,.07)', -12],
      ['hearts', 58, 6, 1.3, 'rgba(255,154,168,.11)', 10],
      ['clubs', 32, 54, 1.4, 'rgba(255,255,255,.07)', 8],
      ['diamonds', 78, 58, 1.2, 'rgba(255,154,168,.11)', -6],
    ] as const
  )
    .map(([s, x, y, k, fill, r]) => `<path d='${SUIT_PATHS[s]}' fill='${fill}' transform='translate(${x} ${y}) rotate(${r} ${5 * k} ${5 * k}) scale(${k})'/>`)
    .join('') +
  `</svg>`;
const pipTile = `url("data:image/svg+xml,${encodeURIComponent(tile)}")`;
</script>

<template>
  <component :is="tag" class="felt">
    <span class="lay lamp" aria-hidden="true" />
    <span class="lay pips" aria-hidden="true" :style="{ backgroundImage: pipTile }" />
    <slot />
  </component>
</template>

<style scoped>
.felt {
  position: relative; isolation: isolate; overflow: hidden; color: var(--felt-ink); background-color: var(--felt);
  background-image:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, .04) 0 1px, transparent 1px 15px),
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, .04) 0 1px, transparent 1px 15px);
}
.lay { position: absolute; pointer-events: none; z-index: -1; }
.lamp {
  width: max(360px, 72%); aspect-ratio: 1; left: 50%; top: 32%; translate: -50% -50%;
  background: radial-gradient(closest-side, rgba(255, 233, 184, .18), rgba(255, 233, 184, .06) 52%, transparent);
  animation: lamp 18s var(--ease) infinite alternate;
}
@keyframes lamp {
  0% { transform: translateX(-24%) scale(.94); opacity: .8; }
  50% { transform: translate(3%, 7%) scale(1.06); opacity: 1; }
  100% { transform: translateX(24%) scale(.96); opacity: .9; }
}
.pips { inset: -96px 0 0 -96px; background-size: 96px 96px; animation: drift 64s linear infinite; }
@keyframes drift { to { transform: translate(96px, 96px); } }
@media (prefers-reduced-motion: reduce) { .lay { animation: none; } }
</style>
