<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { games } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { AppBar } from '@cards/ui';
import { api, type GameSummary } from '../api';
import GameList from './GameList.vue';

const active = ref<GameSummary[]>([]);
const recent = ref<GameSummary[]>([]);
const error = ref<string>();

onMounted(async () => {
  try {
    [active.value, recent.value] = await Promise.all([api.games({ status: 'active' }), api.games({ status: 'finished' })]);
  } catch (err) {
    error.value = (err as Error).message;
  }
});
</script>

<template>
  <AppBar title="cards">
    <span class="suits" aria-hidden="true">♠ <i>♥</i> <i>♦</i> ♣</span>
  </AppBar>
  <main class="page">
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="active.length">
      <h2 class="lbl">In progress</h2>
      <GameList :games="active" />
    </template>

    <h2 class="lbl">New game</h2>
    <div class="tiles">
      <RouterLink v-for="(rules, id) in games" :key="id" :to="`/${id}`" class="tile panel" :class="`g-${id}`">
        <span class="mcard" :class="gameUis[id]?.ink">{{ gameUis[id]?.glyph }}</span>
        <b>{{ rules.name }}</b>
        <span class="mut">{{ gameUis[id]?.blurb }} {{ rules.players.min }}–{{ rules.players.max }} players.</span>
      </RouterLink>
    </div>

    <template v-if="recent.length">
      <h2 class="lbl">Recent</h2>
      <GameList :games="recent.slice(0, 8)" />
    </template>
  </main>
</template>

<style scoped>
.suits { font-size: 16px; letter-spacing: 2px; }
.suits i { font-style: normal; color: var(--felt-red); }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.tile { display: flex; flex-direction: column; gap: 6px; padding: 14px; text-decoration: none; color: var(--ink); }
.tile b { font: 700 18px var(--f-display); }
</style>
