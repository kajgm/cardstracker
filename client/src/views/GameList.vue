<script setup lang="ts">
import { getGame } from '@cards/games';
import type { GameSummary } from '../api';

defineProps<{ games: GameSummary[]; showType?: boolean }>();

const day = (iso: string) =>
  new Date(`${iso.replace(' ', 'T')}Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const ranked = (g: GameSummary) => [...g.players].sort((a, b) => a.place - b.place);
</script>

<template>
  <div class="panel">
    <RouterLink v-for="g in games" :key="g.id" :to="`/${g.type}/${g.id}`" class="row item">
      <span class="grow">
        <b>
          {{ showType === false ? '' : `${getGame(g.type)?.name ?? g.type} · ` }}
          {{ g.status === 'finished' ? `${ranked(g).filter((p) => p.place === 1).map((p) => p.name).join(' & ')} won` : `round ${g.round}` }}
        </b>
        <span class="mut">{{ ranked(g).map((p) => `${p.name} ${p.total}`).join(' · ') }}</span>
      </span>
      <span class="mut when">{{ day(g.finishedAt ?? g.createdAt) }}</span>
    </RouterLink>
  </div>
</template>

<style scoped>
.item { text-decoration: none; color: var(--ink); }
.item .grow { display: flex; flex-direction: column; gap: 2px; }
.item b { font-weight: 600; }
.when { white-space: nowrap; align-self: flex-start; }
</style>
