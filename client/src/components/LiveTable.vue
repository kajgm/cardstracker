<script setup lang="ts">
import { computed } from 'vue';
import { getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import type { GameSummary } from '../api';
import { isLive, since } from '../time';

// A game in progress as a small scoreboard on the felt: round, dealer, top three.
const props = defineProps<{ game: GameSummary }>();
const rules = computed(() => getGame(props.game.type));
const ui = computed(() => gameUis[props.game.type]);
const live = computed(() => isLive(props.game.updatedAt));
const next = computed(() => props.game.next);
const meta = computed(() => {
  const n = next.value;
  if (!n || !ui.value) return '';
  const of = typeof n.info.of === 'number' ? ` of ${n.info.of}` : '';
  return `Round ${n.n + 1}${of} · ${ui.value.roundLabel(n.info, n.dealer)}${props.game.target ? ` · to ${props.game.target}` : ''}`;
});
const progress = computed(() => {
  const n = next.value;
  if (n && typeof n.info.of === 'number') return n.n / n.info.of;
  if (props.game.target) return Math.max(...props.game.players.map((p) => p.total)) / props.game.target;
  return undefined;
});
/** Nobody leads before the first round is scored. */
const started = computed(() => props.game.players.some((p) => p.total !== 0));
const top = computed(() => [...props.game.players].sort((a, b) => a.place - b.place).slice(0, 3));
</script>

<template>
  <RouterLink :to="`/${game.type}/${game.id}`" class="lt" :class="`g-${game.type}`">
    <span class="top">
      <span class="mcard" :class="ui?.ink">{{ ui?.glyph }}</span>
      <b>{{ rules?.name ?? game.type }}</b>
      <span class="state">
        <template v-if="live"><i class="livedot" />Live</template>
        <template v-else>{{ since(game.updatedAt) }}</template>
      </span>
    </span>
    <span class="meta">{{ meta }}</span>
    <span v-if="progress !== undefined" class="prog"><i :style="{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }" /></span>
    <span class="stand">
      <span v-for="p in top" :key="p.name">
        <span class="dot" :style="{ '--c': `var(--${p.color})` }" />{{ p.name }}
        <b class="num">{{ p.total }}</b><span v-if="started && p.place === 1" class="star" aria-label="Leading">★</span>
      </span>
    </span>
  </RouterLink>
</template>

<style scoped>
.lt { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px 12px 11px; border-radius: 14px; background: var(--felt-panel); border: 1px solid var(--felt-rule); color: var(--felt-ink); text-decoration: none; scroll-snap-align: start; transition: transform .15s var(--ease), background-color .2s; }
.lt:active { transform: scale(.98); }
@media (hover: hover) { .lt:hover { background-color: rgba(3, 22, 15, .6); } }
.top { display: flex; align-items: center; gap: 8px; }
.top .mcard { width: 20px; height: 27px; font-size: 12px; border: 0; }
.top b { font: 700 16px/1 var(--f-display); }
.state { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font: 600 11.5px var(--f-body); color: var(--felt-ink-2); white-space: nowrap; }
.meta { font-size: 12.5px; color: var(--felt-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prog { height: 4px; border-radius: 2px; background: rgba(255, 255, 255, .1); overflow: hidden; }
.prog i { display: block; height: 100%; border-radius: 2px; background: var(--felt-ink-2); transition: width .6s var(--ease); }
.stand { display: flex; gap: 12px; font-size: 13px; overflow: hidden; }
.stand > span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.stand .dot { width: 8px; height: 8px; }
.stand b { font-size: 17px; font-weight: 700; }
.star { color: var(--gold-ink); font-size: 11px; }
</style>
