<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { AppBar } from '@cards/ui';
import { api, type GameSummary, type LeaderRow } from '../api';
import GameList from './GameList.vue';

// What cards.kajgm.com/<game> opens: start, resume, the all-time table, past games.
const route = useRoute();
const type = computed(() => String(route.params.game));
const rules = computed(() => getGame(type.value)!);
const ui = computed(() => gameUis[type.value]);
const active = ref<GameSummary[]>([]);
const past = ref<GameSummary[]>([]);
const board = ref<LeaderRow[]>([]);
const error = ref<string>();

watch(
  type,
  async (t) => {
    error.value = undefined;
    try {
      [active.value, past.value, board.value] = await Promise.all([
        api.games({ type: t, status: 'active' }),
        api.games({ type: t, status: 'finished' }),
        api.leaderboard(t),
      ]);
    } catch (err) {
      error.value = (err as Error).message;
    }
  },
  { immediate: true },
);
</script>

<template>
  <AppBar :title="rules.name" back="/" :glyph="ui?.glyph" :glyph-class="ui?.ink" />
  <main class="page">
    <p v-if="error" class="error">{{ error }}</p>
    <RouterLink :to="`/${type}/new`" class="btn pri start">New game</RouterLink>

    <template v-if="active.length">
      <h2 class="lbl">In progress</h2>
      <GameList :games="active" :show-type="false" />
    </template>

    <template v-if="board.length">
      <h2 class="lbl">Leaderboard, all time</h2>
      <div class="panel">
        <table class="lb">
          <thead><tr><th>Player</th><th>Won</th><th>Played</th><th>Avg</th></tr></thead>
          <tbody>
            <tr v-for="r in board" :key="r.playerId">
              <td><span class="dot" :style="{ '--c': `var(--${r.color})` }" /> {{ r.name }}</td>
              <td class="num">{{ r.won }}</td>
              <td class="num">{{ r.played }}</td>
              <td class="num">{{ r.avg }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-if="past.length">
      <h2 class="lbl">Past games</h2>
      <GameList :games="past" :show-type="false" />
    </template>
    <p v-if="!active.length && !past.length && !error" class="mut">No {{ rules.name }} games yet. Start one above.</p>
  </main>
</template>

<style scoped>
.start { font: 700 18px var(--f-display); min-height: 56px; }
.lb { width: 100%; border-collapse: collapse; }
.lb th { font: 600 11px var(--f-body); letter-spacing: .07em; text-transform: uppercase; color: var(--ink-3); text-align: right; padding: 10px 12px 6px; }
.lb td { text-align: right; padding: 8px 12px; border-top: 1px solid var(--line); font-size: 18px; font-weight: 600; }
.lb th:first-child, .lb td:first-child { text-align: left; font-size: 15px; font-weight: 500; }
</style>
