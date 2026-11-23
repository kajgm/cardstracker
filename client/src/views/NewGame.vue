<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { AppBar, RulesForm } from '@cards/ui';
import { api, type Player } from '../api';

// Same for every game: pick players, order the seats, choose the first dealer.
// Only the house rules come from the game.
const route = useRoute();
const router = useRouter();
const type = computed(() => String(route.params.game));
const rules = computed(() => getGame(type.value)!);
const ui = computed(() => gameUis[type.value]);

const roster = ref<Player[]>([]);
const seated = ref<Player[]>([]);
const firstDealer = ref(0);
const edited = ref<Record<string, unknown>>({});
const newName = ref('');
const error = ref<string>();
const busy = ref(false);

onMounted(async () => {
  try {
    roster.value = await api.players();
  } catch (err) {
    error.value = (err as Error).message;
  }
});

const bench = computed(() => roster.value.filter((p) => !seated.value.some((s) => s.id === p.id)));
const seats = computed(() => seated.value.length);
const fits = computed(() => seats.value >= rules.value.players.min && seats.value <= rules.value.players.max);
// Defaults depend on the table size (10-1 starts lower with 6+), so recompute them and keep what was changed.
const config = computed(() => ({ ...rules.value.config.defaults(Math.max(seats.value, rules.value.players.min)), ...edited.value }));

function seat(p: Player) {
  if (seats.value < rules.value.players.max) seated.value.push(p);
}
function unseat(i: number) {
  seated.value.splice(i, 1);
  if (firstDealer.value >= seated.value.length) firstDealer.value = 0;
}
function move(i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= seated.value.length) return;
  const list = [...seated.value];
  [list[i], list[j]] = [list[j], list[i]];
  seated.value = list;
  if (firstDealer.value === i) firstDealer.value = j;
  else if (firstDealer.value === j) firstDealer.value = i;
}
async function add() {
  const name = newName.value.trim();
  if (!name) return;
  error.value = undefined;
  try {
    const p = await api.addPlayer(name);
    roster.value.push(p);
    seat(p);
    newName.value = '';
  } catch (err) {
    error.value = (err as Error).message;
  }
}
async function start() {
  busy.value = true;
  error.value = undefined;
  try {
    const game = await api.createGame({
      type: type.value,
      playerIds: seated.value.map((p) => p.id),
      firstDealer: firstDealer.value,
      config: config.value,
    });
    await router.replace(`/${type.value}/${game.id}`);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppBar :title="`New ${rules.name} game`" :back="`/${type}`" :glyph="ui?.glyph" :glyph-class="ui?.ink" />
  <main class="page">
    <h2 class="lbl">Seats, clockwise from the first dealer</h2>
    <div v-if="seated.length" class="panel">
      <div v-for="(p, i) in seated" :key="p.id" class="row seat">
        <span class="num pos">{{ i + 1 }}</span>
        <span class="dot" :style="{ '--c': `var(--${p.color})` }" />
        <span class="grow">{{ p.name }}</span>
        <button type="button" class="pill" :class="{ on: firstDealer === i }" :aria-pressed="firstDealer === i" @click="firstDealer = i">
          {{ firstDealer === i ? 'Deals first' : 'Deal first' }}
        </button>
        <button type="button" class="icon" :aria-label="`Move ${p.name} up`" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button type="button" class="icon" :aria-label="`Move ${p.name} down`" :disabled="i === seated.length - 1" @click="move(i, 1)">↓</button>
        <button type="button" class="icon" :aria-label="`Remove ${p.name}`" @click="unseat(i)">×</button>
      </div>
    </div>
    <p v-else class="mut">Tap players below to seat them.</p>

    <div class="bench">
      <button v-for="p in bench" :key="p.id" type="button" class="pill add" :disabled="seats >= rules.players.max" @click="seat(p)">
        + {{ p.name }}
      </button>
    </div>
    <form class="addform" @submit.prevent="add">
      <label for="new-player" class="sr">New player's name</label>
      <input id="new-player" v-model="newName" maxlength="24" placeholder="New player" autocomplete="off" />
      <button type="submit" class="btn" :disabled="!newName.trim()">Add</button>
    </form>

    <h2 class="lbl">House rules</h2>
    <RulesForm v-if="ui" :fields="ui.configFields" :model-value="config" @update:model-value="edited = $event" />
    <p v-if="error" class="error">{{ error }}</p>
  </main>
  <div class="actionbar">
    <button type="button" class="btn pri" :disabled="!fits || busy" @click="start">
      {{ fits ? 'Start game' : `${rules.name} takes ${rules.players.min}–${rules.players.max} players` }}
    </button>
  </div>
</template>

<style scoped>
.seat { gap: 8px; }
.pos { width: 14px; color: var(--ink-3); font-size: 17px; }
.pill { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); font-size: 13px; color: var(--ink-2); cursor: pointer; white-space: nowrap; }
.pill.on { background: var(--accent-soft); border-color: var(--accent); color: var(--ink); font-weight: 600; }
.pill.add { border-style: dashed; min-height: 40px; }
.icon { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); cursor: pointer; }
.icon:disabled { background: var(--surface-2); color: var(--ink-3); border-color: var(--line); cursor: not-allowed; }
.bench { display: flex; flex-wrap: wrap; gap: 8px; }
.addform { display: flex; gap: 8px; }
.addform input { flex: 1; min-width: 0; min-height: 46px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); padding: 0 12px; font: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
