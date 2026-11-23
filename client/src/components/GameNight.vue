<script setup lang="ts">
import { computed } from 'vue';
import { getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import type { GameSummary } from '../api';
import { fromSql, listNames } from '../time';

// One evening's games as a card: who won the night, then each game's winner.
const props = defineProps<{ games: GameSummary[] }>();

const date = computed(() =>
  fromSql(props.games[0].finishedAt!).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
);
const winnersOf = (g: GameSummary) => g.players.filter((p) => p.place === 1);
const night = computed(() => {
  const wins = new Map<string, number>();
  for (const g of props.games) for (const p of winnersOf(g)) wins.set(p.name, (wins.get(p.name) ?? 0) + 1);
  const most = Math.max(0, ...wins.values());
  return { names: [...wins].filter(([, n]) => n === most).map(([name]) => name), most };
});
</script>

<template>
  <div class="panel gn">
    <div class="head">
      <p class="date">{{ date }}, {{ games.length }} games</p>
      <p class="win">
        <svg class="crown" viewBox="0 0 20 14" aria-hidden="true"><path d="M1.5 13 .5 3.2 5.6 7.4 10 .6 14.4 7.4 19.5 3.2 18.5 13Z" /></svg>
        {{ listNames(night.names) }} {{ night.names.length > 1 ? 'shared the night' : 'won the night' }}
        <span>{{ night.most }} of {{ games.length }}</span>
      </p>
    </div>
    <RouterLink v-for="g in games" :key="g.id" :to="`/${g.type}/${g.id}`" class="row">
      <span class="mcard" :class="gameUis[g.type]?.ink">{{ gameUis[g.type]?.glyph }}</span>
      <span class="g">{{ getGame(g.type)?.name ?? g.type }}</span>
      <span class="r">
        <template v-for="p in winnersOf(g)" :key="p.name"><span class="dot" :style="{ '--c': `var(--${p.color})` }" />{{ p.name }} </template>
        <b class="num">{{ winnersOf(g)[0]?.total }}</b>
      </span>
    </RouterLink>
  </div>
</template>

<style scoped>
.head { display: flex; flex-direction: column; gap: 4px; padding: 12px 12px 10px; }
.date { margin: 0; font-size: 12.5px; color: var(--ink-3); }
.win { margin: 0; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font: 700 17px/1.2 var(--f-display); }
.win span { font: 500 13px var(--f-body); color: var(--ink-3); }
.crown { width: 18px; height: 13px; fill: var(--gold); flex: none; }
.row { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink); text-decoration: none; }
.row .mcard { width: 20px; height: 27px; font-size: 12px; }
.g { font-weight: 600; }
.r { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); white-space: nowrap; }
.r .dot { width: 8px; height: 8px; }
.r b { font-size: 17px; color: var(--ink); }
</style>
