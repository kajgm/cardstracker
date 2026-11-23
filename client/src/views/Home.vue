<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { games } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { AppBar, TitleCard } from '@cards/ui';
import { api, type GameSummary } from '../api';
import GameList from './GameList.vue';

const active = ref<GameSummary[]>([]);
const recent = ref<GameSummary[]>([]);
const error = ref<string>();
const loading = ref(true);

onMounted(async () => {
  try {
    [active.value, recent.value] = await Promise.all([api.games({ status: 'active' }), api.games({ status: 'finished' })]);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AppBar title="cards">
    <span class="suits" aria-hidden="true">♠ <i>♥</i> <i>♦</i> ♣</span>
  </AppBar>
  <main class="page">
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="loading">
      <h2 class="lbl">In progress</h2>
      <div class="skel" style="height: 64px" />
    </template>
    <template v-else-if="active.length">
      <h2 class="lbl">In progress</h2>
      <GameList :games="active" class="enter" />
    </template>

    <h2 class="lbl">New game</h2>
    <div class="tiles">
      <template v-for="(rules, id) in games" :key="id">
        <RouterLink v-if="gameUis[id]" :to="`/${id}`" class="tile">
          <TitleCard
            :name="rules.name"
            :hand="gameUis[id].hand"
            :blurb="gameUis[id].blurb"
            :facts="[`${rules.players.min}–${rules.players.max} players`, ...gameUis[id].facts.slice(0, 1)]"
            pressable
          />
        </RouterLink>
      </template>
    </div>

    <template v-if="recent.length">
      <h2 class="lbl">Recent</h2>
      <GameList :games="recent.slice(0, 8)" class="enter" />
    </template>
  </main>
</template>

<style scoped>
.suits { font-size: 16px; letter-spacing: 2px; }
.suits i { font-style: normal; color: var(--felt-red); }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 12px; }
.tile { display: block; text-decoration: none; border-radius: 18px; }
</style>
