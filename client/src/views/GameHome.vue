<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { AppBar, Leaderboard, TitleCard } from '@cards/ui';
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
    <TitleCard
      v-if="ui"
      :name="rules.name"
      :hand="ui.hand"
      :facts="[`${rules.players.min}–${rules.players.max} players`, ...ui.facts]"
      size="header"
    >
      <details class="about">
        <summary>How it plays</summary>
        <p>{{ ui.about }}</p>
      </details>
    </TitleCard>
    <p v-if="error" class="error">{{ error }}</p>
    <RouterLink :to="`/${type}/new`" class="btn pri start">New game</RouterLink>

    <template v-if="active.length">
      <h2 class="lbl">In progress</h2>
      <GameList :games="active" :show-type="false" />
    </template>

    <template v-if="board.length">
      <h2 class="lbl">Leaderboard, all time</h2>
      <Leaderboard
        :rows="board.map((r) => ({ key: r.playerId, name: r.name, color: r.color, won: r.won, played: r.played, avg: r.avg, form: r.form }))"
        show-avg
      />
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
.about { margin-top: 12px; border-top: 1px solid var(--felt-rule); padding-top: 10px; }
.about summary { cursor: pointer; font-weight: 600; font-size: 14px; color: var(--felt-ink); min-height: 32px; display: flex; align-items: center; gap: 6px; list-style: none; }
.about summary::-webkit-details-marker { display: none; }
.about summary::after { content: "›"; font-size: 20px; line-height: 1; transition: transform .2s var(--ease); color: var(--felt-ink-2); }
.about[open] summary::after { transform: rotate(90deg); }
.about p { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--felt-ink); animation: rise .3s var(--ease) both; }
</style>
