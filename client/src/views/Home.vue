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
import { byFinish, fromSql, isLive, lastNight, listNames } from '../time';

const router = useRouter();
const active = ref<GameSummary[]>([]);
const finished = ref<GameSummary[]>([]);
const records = ref<RecordLine[]>([]);
const board = ref<LeaderRow[]>([]);
const boardType = ref('all');
/** Any finished game at all: the leaderboard section shows from then on. */
const anyResults = ref(false);
const loading = ref(true);
const error = ref<string>();

async function loadBoard() {
  board.value = await api.leaderboard(boardType.value);
  if (boardType.value === 'all') anyResults.value = board.value.length > 0;
}
async function load() {
  try {
    [active.value, finished.value, records.value] = await Promise.all([
      api.games({ status: 'active' }),
      api.games({ status: 'finished' }),
      api.records(),
    ]);
    await loadBoard();
    error.value = undefined;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}
function pickBoard(type: string) {
  boardType.value = type;
  void loadBoard().catch((err) => (error.value = (err as Error).message));
}
// Live tables move on while the page is open; a minute is fresh enough for a home page.
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  timer = setInterval(() => document.visibilityState === 'visible' && void load(), 60_000);
});
onBeforeUnmount(() => clearInterval(timer));

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
  if (loading.value) return '';
  const parts: string[] = [];
  if (live.value.length) parts.push(`${live.value.length} ${live.value.length === 1 ? 'table' : 'tables'} live`);
  if (thisWeek.value) parts.push(`${thisWeek.value} ${thisWeek.value === 1 ? 'game' : 'games'} this week`);
  return parts.join(' · ') || 'Pick a game to start.';
});

// ---- same table again ----
const recent = computed(() => byFinish(finished.value));
const last = computed(() => recent.value[0]);
const againText = computed(() => {
  const g = last.value;
  if (!g) return '';
  const dealer = g.players[(g.firstDealer + 1) % g.players.length]?.name;
  return `${getGame(g.type)?.name ?? g.type} with ${listNames(g.players.map((p) => p.name))} · ${dealer} deals`;
});
const starting = ref(false);
async function again() {
  if (!last.value || starting.value) return;
  starting.value = true;
  try {
    const g = await api.rematch(last.value.id);
    await router.push(`/${g.type}/${g.id}`);
  } catch (err) {
    error.value = (err as Error).message;
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
          <p class="date">{{ today }}</p>
          <h1 class="greet">{{ greeting }}</h1>
          <p class="sub">{{ sub }}&nbsp;</p>
        </div>
        <div v-if="tables.length" class="live">
          <LiveTable v-for="g in tables" :key="g.id" :game="g" />
        </div>
      </div>
    </div>
  </Felt>

  <main class="home">
    <p v-if="error" class="error wide">{{ error }}</p>
    <div class="col">
      <section class="sec new">
        <h2 class="lbl">New game</h2>
        <button v-if="last" type="button" class="again" :disabled="starting" @click="again">
          <span class="again-ic" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" /><path d="M4.5 3.2v3.3h3.3" /></svg>
          </span>
          <span class="again-t"><b>{{ starting ? 'Starting…' : 'Same table again' }}</b><small>{{ againText }}</small></span>
          <span class="again-go" aria-hidden="true">›</span>
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
      <section v-if="recent.length" class="sec recent">
        <h2 class="lbl">Recent</h2>
        <GameList :games="recent.slice(0, 5)" class="enter" />
      </section>
    </div>

    <div class="col">
      <section v-if="loading" class="sec board">
        <h2 class="lbl">Leaderboard</h2>
        <div class="skel" style="height: 220px" />
      </section>
      <section v-else-if="anyResults" class="sec board">
        <div class="lblrow">
          <h2 class="lbl">Leaderboard</h2>
          <div class="chips" role="tablist" aria-label="Which games">
            <button
              v-for="t in boardTabs"
              :key="t.id"
              type="button"
              role="tab"
              :aria-selected="boardType === t.id"
              @click="pickBoard(t.id)"
            >
              {{ t.name }}
            </button>
          </div>
        </div>
        <Leaderboard v-if="rows.length" :rows="rows" :show-avg="boardType !== 'all'" />
        <p v-else class="mut">No finished {{ getGame(boardType)?.name }} games yet.</p>
      </section>
      <section v-if="night.length >= 2" class="sec night">
        <h2 class="lbl">Last game night</h2>
        <GameNight :games="night" />
      </section>
      <section v-if="records.length" class="sec recs">
        <h2 class="lbl">Records</h2>
        <RecordTiles :records="records" />
      </section>
    </div>
  </main>
</template>

<style scoped>
/* Felt header: wordmark, greeting and the games being played right now. */
.hero { padding-top: env(safe-area-inset-top); }
.in { max-width: 72rem; margin: 0 auto; padding: 8px max(16px, env(safe-area-inset-right)) 18px max(16px, env(safe-area-inset-left)); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 58px; }
.livepill { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px 6px 10px; border-radius: 999px; background: var(--felt-panel); border: 1px solid var(--felt-rule); font: 600 13px/1 var(--f-body); color: var(--felt-ink); text-decoration: none; white-space: nowrap; }
.hello { margin: 14px 0 16px; }
.date { margin: 0; font: 600 11px var(--f-body); letter-spacing: .12em; text-transform: uppercase; color: var(--felt-ink-2); }
.greet { margin: 4px 0 3px; font: 800 32px/1.02 var(--f-display); letter-spacing: -.03em; }
.sub { margin: 0; font-size: 14px; color: var(--felt-ink-2); }
.live { display: grid; grid-auto-flow: column; grid-auto-columns: 86%; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; scrollbar-width: none; }
.live::-webkit-scrollbar, .tiles::-webkit-scrollbar { display: none; }
.live:has(> :only-child) { grid-auto-columns: 100%; }

/* Body: one column on phones, two on wide screens. */
.home { max-width: 72rem; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; padding: 20px max(16px, env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.col { display: contents; }
.sec { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.new { order: 1; } .board { order: 2; } .night { order: 3; } .recs { order: 4; } .recent { order: 5; }
.lblrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.tiles { display: grid; grid-auto-flow: column; grid-auto-columns: 80%; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; scrollbar-width: none; }
.tile { display: block; text-decoration: none; border-radius: 18px; scroll-snap-align: start; }

.again { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 10px 14px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; transition: transform .12s var(--ease); }
.again:active:not(:disabled) { transform: scale(.98); }
.again-ic { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--table-soft); color: var(--table); flex: none; }
.again-ic svg { width: 18px; height: 18px; }
.again-t { display: flex; flex-direction: column; min-width: 0; }
.again-t b { font-size: 15px; }
.again-t small { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.again-go { margin-left: auto; font-size: 24px; line-height: 1; color: var(--ink-3); }

.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (min-width: 900px) {
  .in { padding-bottom: 28px; }
  .top { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 32px; align-items: end; margin-top: 14px; }
  .hello { margin: 0 0 4px; }
  .greet { font-size: 48px; }
  .live { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; margin: 0; padding: 0; }
  .live:has(> :only-child) { grid-template-columns: minmax(0, 1fr); }
  .home { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 32px; align-items: start; padding-top: 28px; }
  .home .wide { grid-column: 1 / -1; }
  .col { display: flex; flex-direction: column; gap: 28px; }
  .tiles { grid-auto-flow: row; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); overflow: visible; margin: 0; padding: 0; }
}
</style>
