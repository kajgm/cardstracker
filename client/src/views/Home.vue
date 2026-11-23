<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { games, getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { Felt, Leaderboard, TitleCard } from '@cards/ui';
import { api, type GameSummary, type LeaderRow, type RecordLine } from '../api';
import GameList from './GameList.vue';
import Wordmark from '../components/Wordmark.vue';
import LiveTable from '../components/LiveTable.vue';
import GameNight from '../components/GameNight.vue';
import RecordTiles from '../components/RecordTiles.vue';
import Region from '../components/Region.vue';
import { byFinish, fromSql, isLive, lastNight, listNames } from '../time';

const router = useRouter();
const active = ref<GameSummary[]>([]);
const finished = ref<GameSummary[]>([]);
const records = ref<RecordLine[]>([]);
const board = ref<LeaderRow[]>([]);
const boardType = ref('all');
const loading = ref(true);
const failed = ref(false);
const boardFailed = ref(false);
const actionError = ref<string>();

async function loadBoard() {
  try {
    board.value = await api.leaderboard(boardType.value);
    boardFailed.value = false;
  } catch {
    boardFailed.value = true;
  }
}
async function load() {
  try {
    [active.value, finished.value, records.value] = await Promise.all([
      api.games({ status: 'active' }),
      api.games({ status: 'finished' }),
      api.records(),
    ]);
    failed.value = false;
  } catch {
    failed.value = true;
  }
  await loadBoard();
  loading.value = false;
}
function pickBoard(type: string) {
  boardType.value = type;
  void loadBoard();
}
// Live tables move on while the page is open; a minute is fresh enough for a home page.
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  timer = setInterval(() => document.visibilityState === 'visible' && void load(), 60_000);
});
onBeforeUnmount(() => clearInterval(timer));

/** Loading, error, empty or full, for one region. */
const stateOf = (has: boolean, broken = failed.value) =>
  loading.value ? 'loading' : broken ? 'error' : has ? 'full' : 'empty';

// ---- felt header ----
const now = new Date();
const greeting = now.getHours() < 5 ? 'Good evening' : now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const tables = computed(() => [...active.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const live = computed(() => tables.value.filter((g) => isLive(g.updatedAt)));
const thisWeek = computed(
  () => finished.value.filter((g) => g.finishedAt && Date.now() - fromSql(g.finishedAt).getTime() < 7 * 86_400_000).length,
);
const sub = computed(() => {
  const n = live.value.length;
  const w = thisWeek.value;
  if (loading.value || failed.value) return `${today}.`;
  if (n) return `${today}. ${n === 1 ? 'One table is' : `${n} tables are`} playing now.`;
  if (w) return `${today}. ${w} ${w === 1 ? 'game' : 'games'} finished this week.`;
  return `${today}. Pick a game to start.`;
});

// ---- same table again ----
const recent = computed(() => byFinish(finished.value));
const last = computed(() => recent.value[0]);
const againText = computed(() => {
  const g = last.value;
  if (!g) return '';
  const dealer = g.players[(g.firstDealer + 1) % g.players.length]?.name;
  return `${getGame(g.type)?.name ?? g.type} with ${listNames(g.players.map((p) => p.name))}. ${dealer} deals.`;
});
const starting = ref(false);
async function again() {
  if (!last.value || starting.value) return;
  starting.value = true;
  actionError.value = undefined;
  try {
    const g = await api.rematch(last.value.id);
    await router.push(`/${g.type}/${g.id}`);
  } catch (err) {
    actionError.value = (err as Error).message;
  } finally {
    starting.value = false;
  }
}

// ---- leaderboard, game night ----
const rows = computed(() =>
  board.value.map((r) => ({ key: r.playerId, name: r.name, color: r.color, won: r.won, played: r.played, avg: r.avg, form: r.form })),
);
const boardTabs = computed(() => [{ id: 'all', name: 'All games' }, ...Object.values(games).map((g) => ({ id: g.id, name: g.name }))]);
const night = computed(() => lastNight(finished.value));
</script>

<template>
  <Felt tag="header" class="hero">
    <div class="in">
      <div class="bar">
        <Wordmark />
        <Transition name="fade">
          <RouterLink v-if="live.length" :to="`/${live[0].type}/${live[0].id}`" class="livepill">
            <i class="livedot" />{{ live.length }} live
          </RouterLink>
        </Transition>
      </div>
      <div class="top">
        <div class="hello">
          <h1 class="greet">{{ greeting }}</h1>
          <p class="sub">{{ sub }}</p>
        </div>
        <div v-if="tables.length" class="live">
          <LiveTable v-for="g in tables" :key="g.id" :game="g" />
        </div>
      </div>
    </div>
  </Felt>

  <main class="home">
    <div class="col">
      <section class="sec new">
        <h2 class="lbl">New game</h2>
        <p v-if="actionError" class="error">{{ actionError }}</p>
        <button v-if="last" type="button" class="again" :disabled="starting" @click="again">
          <span class="again-ic" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" /><path d="M4.5 3.2v3.3h3.3" /></svg>
          </span>
          <span class="again-t"><b>{{ starting ? 'Starting…' : 'Same table again' }}</b><small>{{ againText }}</small></span>
        </button>
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
      </section>
      <Region title="Recent games" class="recent" :state="stateOf(recent.length > 0)" :skeleton="120" @retry="load">
        <GameList :games="recent.slice(0, 5)" />
        <template #empty>Finished games show up here, newest first.</template>
      </Region>
    </div>

    <div class="col">
      <Region title="Leaderboard" class="board" :state="stateOf(rows.length > 0, boardFailed)" :skeleton="220" @retry="loadBoard">
        <template #tools>
          <div class="chips" role="tablist" aria-label="Which games">
            <button v-for="t in boardTabs" :key="t.id" type="button" role="tab" :aria-selected="boardType === t.id" @click="pickBoard(t.id)">
              {{ t.name }}
            </button>
          </div>
        </template>
        <Leaderboard :rows="rows" :show-avg="boardType !== 'all'" />
        <template #empty>
          {{ boardType === 'all' ? 'Finish a game and the standings start here: wins, games played and each player’s last five finishes.' : `No finished ${getGame(boardType)?.name} games yet.` }}
        </template>
      </Region>
      <Region title="Last game night" class="night" :state="stateOf(night.length >= 2)" :skeleton="150" @retry="load">
        <GameNight :games="night" />
        <template #empty>Play two or more games in one evening and the winner of the night shows here.</template>
      </Region>
      <Region title="Records" class="recs" :state="stateOf(records.length > 0)" :skeleton="150" @retry="load">
        <RecordTiles :records="records" />
        <template #empty>Win streaks, best scores, moons and bid accuracy show here once games are finished.</template>
      </Region>
    </div>
  </main>
</template>

<style scoped>
/* Felt header: the wordmark, a greeting and the games being played right now, over floating cards. */
.hero { padding-top: env(safe-area-inset-top); }
.in { max-width: 72rem; margin: 0 auto; padding: 8px max(16px, env(safe-area-inset-right)) 20px max(16px, env(safe-area-inset-left)); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; }
.livepill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: var(--felt-panel); border: 1px solid var(--felt-rule); font: 600 13px/1 var(--f-body); color: var(--felt-ink); text-decoration: none; white-space: nowrap; }
/* On phones the text keeps to the left two-thirds; the floating cards have the rest. */
.hello { margin: 24px 0 20px; max-width: min(17rem, 66%); }
.greet { margin: 0 0 4px; font: 800 36px/1 var(--f-display); letter-spacing: -.03em; text-wrap: balance; overflow-wrap: break-word; min-width: 0; }
.sub { margin: 0; font-size: 15px; line-height: 1.4; color: var(--felt-ink-2); }
.live { display: grid; grid-auto-flow: column; grid-auto-columns: 86%; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; scrollbar-width: none; }
.live::-webkit-scrollbar, .tiles::-webkit-scrollbar { display: none; }
.live:has(> :only-child) { grid-auto-columns: 100%; }

/* Body: one column on phones, two on wide screens. */
.home { max-width: 72rem; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; padding: 24px max(16px, env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.col { display: contents; }
.sec { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.new { order: 1; } .board { order: 2; } .night { order: 3; } .recs { order: 4; } .recent { order: 5; }
.tiles { display: grid; grid-auto-flow: column; grid-auto-columns: 80%; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; scrollbar-width: none; }
.tile { display: block; text-decoration: none; border-radius: 18px; scroll-snap-align: start; }

.again { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 12px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; transition: transform .12s var(--ease), border-color .15s; }
@media (hover: hover) { .again:hover:not(:disabled) { border-color: var(--line-2); } }
.again:active:not(:disabled) { transform: scale(.98); }
.again:disabled { cursor: progress; color: var(--ink-3); }
.again-ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--table-soft); color: var(--table); flex: none; }
.again-ic svg { width: 18px; height: 18px; }
.again-t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.again-t b { font-size: 15px; }
.again-t small { font-size: 13px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (min-width: 900px) {
  .in { padding-bottom: 32px; }
  .top { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 32px; align-items: end; margin-top: 16px; }
  .hello { margin: 0 0 4px; max-width: none; }
  .greet { font-size: 52px; }
  .live { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; margin: 0; padding: 0; }
  .live:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }
  .home { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 32px; align-items: start; padding-top: 32px; }
  .col { display: flex; flex-direction: column; gap: 32px; }
  .tiles { grid-auto-flow: row; grid-template-columns: repeat(auto-fill, minmax(min(100%, 232px), 1fr)); overflow: visible; margin: 0; padding: 0; }
}
</style>
