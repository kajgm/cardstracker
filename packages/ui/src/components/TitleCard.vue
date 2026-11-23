<script setup lang="ts">
import type { GameHand } from '../game-ui';
import PlayingCard from './PlayingCard.vue';

// A game's title card: a hand of cards on baize that tells the game, then the
// name, a line about it and a few facts. Cards deal in on mount and fan wider on press.
withDefaults(
  defineProps<{ name: string; hand: GameHand; blurb?: string; facts?: string[]; size?: 'tile' | 'header'; tag?: string; pressable?: boolean }>(),
  { size: 'tile', tag: 'div', blurb: undefined, facts: () => [] },
);
</script>

<template>
  <component :is="tag" class="tc" :class="[size, `l-${hand.layout}`, { pressable }]">
    <div class="fan" aria-hidden="true">
      <div v-for="(c, i) in hand.cards" :key="i" class="mc" :style="{ '--i': i, '--n': hand.cards.length }">
        <div class="lift"><PlayingCard :card="c" /></div>
      </div>
    </div>
    <div class="body">
      <b>{{ name }}</b>
      <p v-if="blurb">{{ blurb }}</p>
      <div v-if="facts.length" class="facts"><span v-for="f in facts" :key="f">{{ f }}</span></div>
      <slot />
    </div>
  </component>
</template>

<style scoped>
.tc {
  display: block; position: relative; overflow: hidden; border-radius: 18px; text-decoration: none;
  background-color: var(--felt); color: var(--felt-ink);
  background-image:
    repeating-linear-gradient(45deg, var(--felt-lattice) 0 1px, transparent 1px 12px),
    repeating-linear-gradient(-45deg, var(--felt-lattice) 0 1px, transparent 1px 12px);
  -webkit-user-select: none; user-select: none;
  transition: transform .2s var(--ease);
}
.tc.pressable:active { transform: scale(.98); }
.fan { position: relative; height: 136px; }
.header .fan { height: 130px; }

/* Each card has two layers: .mc holds the fanned pose (and the press spread), .lift runs the deal-in. */
.mc {
  --a: calc((var(--i) - (var(--n) - 1) / 2) * 17deg);
  position: absolute; left: 50%; bottom: 6px; width: 66px; height: 92px; margin-left: -33px;
  transform-origin: 50% 160%; transform: rotate(var(--a));
  transition: transform .45s var(--spring);
}
.lift {
  width: 100%; height: 100%; border-radius: 7px; filter: drop-shadow(0 6px 8px var(--felt-shade));
  animation: deal .55s var(--spring) both; animation-delay: calc(var(--i) * 70ms + 60ms);
}
@keyframes deal { from { transform: translate(110px, 90px) rotate(40deg); opacity: 0; } }
.fan .mc:nth-child(1) { z-index: 1; } .fan .mc:nth-child(2) { z-index: 2; }
.fan .mc:nth-child(3) { z-index: 3; } .fan .mc:nth-child(4) { z-index: 4; }
@media (hover: hover) { .tc:hover .mc { transform: rotate(calc(var(--a) * 1.25)) translateY(-4px); } }
.tc.pressable:active .mc { transform: rotate(calc(var(--a) * 1.25)) translateY(-4px); }

/* 10-1: a hand that gets smaller card by card */
.l-stair .mc { transform-origin: 50% 100%; --x: calc((var(--i) - (var(--n) - 1) / 2) * 40px); --s: calc(1 - var(--i) * .09);
  transform: translateX(var(--x)) rotate(calc(var(--a) * .35)) scale(var(--s)); }
@media (hover: hover) { .tc.l-stair:hover .mc { transform: translateX(calc(var(--x) * 1.15)) rotate(calc(var(--a) * .5)) scale(var(--s)); } }
.tc.pressable.l-stair:active .mc { transform: translateX(calc(var(--x) * 1.15)) rotate(calc(var(--a) * .5)) scale(var(--s)); }

.body { position: relative; z-index: 5; margin-top: -18px; padding: 24px 16px 16px; background: linear-gradient(to bottom, transparent, var(--felt-2) 26px); }
.body b { display: block; font: 800 30px/1 var(--f-display); letter-spacing: -.025em; margin-bottom: 6px; }
.header .body b { font-size: 34px; }
.body p { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--felt-ink); }
.facts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.facts span { font: 600 11px var(--f-body); padding: 3px 8px; border-radius: 999px; border: 1px solid var(--felt-rule); color: var(--felt-ink-2); }
</style>
