<script setup lang="ts">
import type { CardFace } from '../game-ui';
import PlayingCard from './PlayingCard.vue';

// Baize with a few cards floating at different depths, mostly to the right so
// text on the left stays clear. Only transform animates; still with reduced motion.
withDefaults(defineProps<{ tag?: string }>(), { tag: 'div' });

interface Floater {
  x: string;
  y: string;
  /** Width in px; height follows the card's 66 × 92 shape. */
  w: number;
  r: number;
  /** Seconds per drift; negative delays start each card mid-drift. */
  d: number;
  delay: number;
  face?: CardFace;
  back?: 1 | 2;
  far?: boolean;
}
const cards: Floater[] = [
  { x: '30%', y: '6%', w: 22, r: 10, d: 12, delay: -4, back: 2, far: true },
  { x: '46%', y: '68%', w: 26, r: -18, d: 10, delay: -7, back: 1, far: true },
  { x: '58%', y: '10%', w: 46, r: -12, d: 11, delay: -2, face: { rank: 'A', suit: 'hearts' } },
  { x: '68%', y: '60%', w: 30, r: 8, d: 12, delay: -5, back: 2, far: true },
  { x: '78%', y: '26%', w: 54, r: 14, d: 13, delay: -9, face: { rank: 'Q', suit: 'spades' } },
  { x: '90%', y: '0%', w: 34, r: -24, d: 9, delay: -3, back: 1, far: true },
  { x: '92%', y: '66%', w: 40, r: 22, d: 14, delay: -6, face: { rank: 'K', suit: 'hearts' } },
];
</script>

<template>
  <component :is="tag" class="felt">
    <span class="cards" aria-hidden="true">
      <span
        v-for="(c, i) in cards"
        :key="i"
        class="fc"
        :class="{ far: c.far, back: c.back, b2: c.back === 2 }"
        :style="{ left: c.x, top: c.y, '--w': c.w, '--r': `${c.r}deg`, animationDuration: `${c.d}s`, animationDelay: `${c.delay}s` }"
      >
        <PlayingCard v-if="c.face" :card="c.face" />
      </span>
    </span>
    <slot />
  </component>
</template>

<style scoped>
.felt {
  position: relative; isolation: isolate; overflow: hidden; color: var(--felt-ink); background-color: var(--felt);
  background-image:
    repeating-linear-gradient(45deg, var(--felt-lattice) 0 1px, transparent 1px 15px),
    repeating-linear-gradient(-45deg, var(--felt-lattice) 0 1px, transparent 1px 15px);
}
/* The cards sit behind the content, under a veil that keeps the left side readable. */
.cards { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.cards::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, var(--felt) 10%, transparent 70%); opacity: .7; }
.fc {
  position: absolute; width: calc(var(--w) * 1px); aspect-ratio: 66 / 92; border-radius: 6px; transform: rotate(var(--r));
  filter: drop-shadow(0 10px 12px var(--felt-shade));
  animation: float ease-in-out infinite alternate;
}
.fc.far { opacity: .55; filter: blur(1px) drop-shadow(0 6px 8px var(--felt-shade)); }
.fc.back {
  background:
    repeating-linear-gradient(45deg, var(--card-weave) 0 1.5px, transparent 1.5px 5px),
    repeating-linear-gradient(-45deg, var(--card-weave) 0 1.5px, transparent 1.5px 5px),
    var(--back, var(--card-back));
  box-shadow: inset 0 0 0 3px var(--card-face);
}
.fc.b2 { --back: var(--card-back-2); }
@keyframes float {
  from { transform: translateY(8px) rotate(var(--r)); }
  to { transform: translateY(-12px) rotate(calc(var(--r) + 8deg)); }
}
/* Bigger header, bigger cards. */
@media (min-width: 900px) { .fc { width: calc(var(--w) * 1.6px); } }
@media (prefers-reduced-motion: reduce) { .fc { animation: none; } }
</style>
