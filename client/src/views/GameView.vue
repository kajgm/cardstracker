<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { phaseIssues, roundContext, type RoundView } from '@cards/engine';
import { AppBar, ScoreGrid, Sheet, StandingsStrip, type Flourish, type TablePlayer } from '@cards/ui';
import { api, type StatLine } from '../api';
import { useGame } from '../useGame';
import { connected } from '../socket';
import { buzz, useWakeLock } from '../device';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const { game, rules, ui, stored, view, error, notice, save, undo, end, resume } = useGame(id);

const players = computed<TablePlayer[]>(() => game.value?.players ?? []);
const nameOf = (seat: number) => players.value.find((p) => p.seat === seat)?.name ?? '';
const sideName = (side: number) =>
  players.value.filter((p) => p.side === side).map((p) => p.name).join(' & ');
const target = computed(() => (typeof game.value?.config.target === 'number' ? game.value.config.target : undefined));

const meta = computed(() => {
  const v = view.value;
  if (!v || !ui.value) return [];
  if (v.over) {
    const n = v.rounds.filter((r) => r.complete).length;
    return [v.endedEarly ? 'Ended early' : 'Final', `${n} ${n === 1 ? 'round' : 'rounds'}`];
  }
  const next = v.next!;
  const of = typeof next.info.of === 'number' ? ` of ${next.info.of}` : '';
  return [`Round ${next.n + 1}${of}`, ui.value.roundLabel(next.info, nameOf(next.dealer)), ...(target.value ? [`to ${target.value}`] : [])];
});

/** Completed rounds; nobody leads before the first one is scored. */
const played = computed(() => view.value?.rounds.filter((r) => r.complete).length ?? 0);
const standings = computed(() =>
  (view.value?.standings ?? []).map((s) => ({
    key: s.side,
    name: sideName(s.side),
    color: players.value.find((p) => p.side === s.side)?.color ?? 'p8',
    total: s.total,
    place: played.value ? s.place : 0,
    progress: target.value ? s.total / target.value : undefined,
  })),
);
const leaders = computed(() => (view.value?.standings ?? []).filter((s) => s.place === 1).map((s) => s.side));
const rowLabel = (r: RoundView) => (typeof r.info.cards === 'number' ? `${r.info.cards} ♠` : String(r.n + 1));

// ---- entry sheet ----
interface Draft {
  n: number;
  phase: string;
  /** Phases shown: just the one being entered, or all of them when correcting a round. */
  phases: string[];
  entry: Record<string, unknown>;
  correcting: boolean;
}
const draft = ref<Draft>();
const sheet = ref<InstanceType<typeof Sheet>>();

function open(n: number, phase: string, correcting: boolean) {
  if (!rules.value || !ui.value || !game.value) return;
  const saved = game.value.rounds.find((r) => r.n === n)?.entry;
  const ids = rules.value.phases.map((p) => p.id);
  const idx = ids.indexOf(phase);
  draft.value = {
    n,
    phase,
    phases: correcting ? ids.slice(0, idx + 1) : [phase],
    // A plain copy: the saved entry is a reactive proxy, which structuredClone rejects.
    entry: JSON.parse(JSON.stringify(ui.value.startEntry(phase, players.value.length, saved))),
    correcting,
  };
}
function enterNext() {
  const next = view.value?.next;
  if (next) open(next.n, next.phase, false);
}
function correct(n: number) {
  const r = view.value?.rounds.find((x) => x.n === n);
  if (r) open(n, r.phase, true);
}

const draftRound = computed(() => {
  if (!draft.value || !rules.value || !stored.value) return undefined;
  const ctx = roundContext(rules.value, stored.value, draft.value.n);
  return { ctx, info: rules.value.roundInfo(ctx) };
});
const issues = computed(() =>
  draft.value && rules.value && draftRound.value
    ? phaseIssues(rules.value, draft.value.phase, draft.value.entry, draftRound.value.ctx)
    : [],
);
const phaseLabel = (pid: string) => rules.value?.phases.find((p) => p.id === pid)?.label ?? pid;

// Saves are optimistic: the sheet closes and the round lands at once. If the
// server refuses, the round rolls back and the sheet reopens with what was typed.
async function submit() {
  if (!draft.value) return;
  const sent = draft.value;
  sheet.value?.close();
  const ok = await save(sent.n, sent.phase, sent.entry);
  if (ok) buzz(12);
  else setTimeout(() => (draft.value = sent), 300);
}

// ---- undo, two taps ----
const armedUndo = ref(false);
const lastRound = computed(() => view.value?.rounds[view.value.rounds.length - 1]);
async function undoLast() {
  if (!lastRound.value) return;
  if (!armedUndo.value) {
    armedUndo.value = true;
    setTimeout(() => (armedUndo.value = false), 4000);
    return;
  }
  armedUndo.value = false;
  if (await undo(lastRound.value.n)) buzz(8);
}

// ---- end early, two taps; resume undoes it ----
const armedEnd = ref(false);
const leaderNames = computed(() => leaders.value.map(sideName).join(' & '));
async function endNow() {
  if (!armedEnd.value) {
    armedEnd.value = true;
    setTimeout(() => (armedEnd.value = false), 5000);
    return;
  }
  armedEnd.value = false;
  if (await end()) buzz([12, 40, 12]);
}
async function resumeGame() {
  if (await resume()) buzz(8);
}

// ---- flourish: a moon, say, gets a moment on every phone at the table ----
const flourish = ref<Flourish>();
let seen = -1;
let flourishTimer: ReturnType<typeof setTimeout> | undefined;
// -1 until the game has loaded, so opening a game never replays an old moon.
watch(() => (view.value ? played.value : -1), (now) => {
  if (now < 0) return;
  const fresh = seen >= 0 && now > seen;
  seen = now;
  if (!fresh || !ui.value?.flourish || !view.value) return;
  const last = [...view.value.rounds].reverse().find((r) => r.complete);
  const f = last && ui.value.flourish(last.entry as Record<string, unknown>, players.value);
  if (!f) return;
  flourish.value = f;
  buzz([20, 60, 20]);
  clearTimeout(flourishTimer);
  flourishTimer = setTimeout(() => (flourish.value = undefined), 2400);
});

// ---- the screen stays on while a game is open ----
const wake = useWakeLock();
onMounted(wake.on);
onBeforeUnmount(wake.off);

// ---- end of game ----
const stats = ref<StatLine[]>([]);
watch(
  () => [view.value?.over, game.value?.version],
  async ([over]) => {
    if (over) stats.value = await api.stats(id.value).catch(() => []);
  },
);
const winners = computed(() => (view.value?.winners ?? []).map(sideName).join(' & '));
async function rematch() {
  const g = await api.rematch(id.value);
  await router.push(`/${g.type}/${g.id}`);
}
const statText = (s: StatLine) =>
  players.value
    .map((p) => ({ p, v: s.values[p.seat] }))
    .filter(({ v }) => s.kind === 'rate' || v > 0)
    .sort((a, b) => b.v - a.v)
    .map(({ p, v }) => `${p.name} ${s.kind === 'rate' ? `${Math.round(v * 100)}%` : v}`)
    .join(' · ') || 'Nobody';
</script>

<template>
  <AppBar
    :title="rules?.name ?? 'Loading…'"
    :back="`/${route.params.game}`"
    :glyph="ui?.glyph"
    :glyph-class="ui?.ink"
    :meta="meta"
  />
  <main class="page">
    <p v-if="error" class="error">{{ error }}</p>
    <Transition name="drop">
      <p v-if="notice" class="error" role="alert">{{ notice }}</p>
    </Transition>
    <Transition name="drop">
      <p v-if="!connected" class="offline" role="status"><span class="spin" aria-hidden="true" />Reconnecting…</p>
    </Transition>

    <template v-if="!game && !error">
      <div class="skel" style="height: 62px" />
      <div class="skel" style="height: 260px" />
    </template>

    <template v-if="game && view">
      <section v-if="view.over" class="panel final">
        <span class="crown" aria-hidden="true">♛</span>
        <b>{{ winners }} {{ view.winners.length > 1 ? 'tie for the win' : 'wins' }}</b>
        <span class="mut">{{ view.endedEarly ? `Ended early after ${played} ${played === 1 ? 'round' : 'rounds'}` : `${view.rounds.length} rounds` }}</span>
      </section>

      <StandingsStrip :entries="standings" />
      <ScoreGrid
        :players="players"
        :rounds="view.rounds"
        :totals="view.totals"
        :leaders="played ? leaders : []"
        :dealer="view.next?.dealer"
        :cell="ui?.cell"
        :row-label="rowLabel"
        :legend="ui?.legend"
        @edit="correct"
      />
      <div class="under">
        <p class="mut">Tap a round to correct it.</p>
        <button v-if="!view.over && played" type="button" class="endbtn" :class="{ armed: armedEnd }" @click="endNow">
          {{ armedEnd ? `End now? ${leaderNames} ${leaders.length > 1 ? 'share the win' : 'wins'}` : 'End game now' }}
        </button>
      </div>

      <template v-if="view.over && stats.length">
        <h2 class="lbl">This game</h2>
        <div class="panel">
          <div v-for="s in stats" :key="s.label" class="row stat">
            <span class="grow">{{ s.label }}</span><span class="mut">{{ statText(s) }}</span>
          </div>
        </div>
      </template>
    </template>
  </main>

  <div v-if="game && view" class="actionbar">
    <button v-if="view.endedEarly" type="button" class="btn" @click="resumeGame">Resume game</button>
    <button v-else-if="lastRound" type="button" class="btn" @click="undoLast">
      {{ armedUndo ? `Undo round ${lastRound.n + 1}?` : 'Undo' }}
    </button>
    <button v-if="view.next" type="button" class="btn pri" @click="enterNext">
      {{ phaseLabel(view.next.phase) }} · round {{ view.next.n + 1 }}
    </button>
    <button v-else type="button" class="btn pri" @click="rematch">Rematch · {{ nameOf((game.firstDealer + 1) % players.length) }} deals</button>
  </div>

  <Transition name="flourish">
    <div v-if="flourish" class="flourish" role="status" @click="flourish = undefined">
      <span class="fg" aria-hidden="true">{{ flourish.glyph }}</span>
      <b>{{ flourish.text }}</b>
    </div>
  </Transition>

  <Sheet
    v-if="draft && draftRound && ui && game"
    ref="sheet"
    :title="draft.correcting ? `Correct round ${draft.n + 1}` : `${phaseLabel(draft.phase)} · round ${draft.n + 1}`"
    :subtitle="ui.roundLabel(draftRound.info, nameOf(draftRound.ctx.dealer))"
    :issues="issues"
    :save-label="draft.correcting ? 'Save correction' : `Save ${phaseLabel(draft.phase).toLowerCase()}`"
    @save="submit"
    @close="draft = undefined"
  >
    <component
      :is="ui.editors[pid]"
      v-for="pid in draft.phases"
      :key="pid"
      v-model="draft.entry"
      :players="players"
      :config="game.config"
      :info="draftRound.info"
      :dealer="draftRound.ctx.dealer"
    />
  </Sheet>
</template>

<style scoped>
.final { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px; text-align: center; }
.final b { font: 800 24px var(--f-display); }
.final { animation: rise .4s var(--ease) both; }
.stat { flex-wrap: wrap; row-gap: 2px; }
.stat .grow { flex: 1 0 auto; min-width: auto; }
.stat .mut { text-align: right; margin-left: auto; }
.under { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.under .mut { margin: 0; }
.endbtn { min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-2); background: transparent; color: var(--ink-2); font: 600 13.5px var(--f-body); cursor: pointer; transition: background-color .2s, color .2s, border-color .2s; }
.endbtn.armed { background: var(--warn-soft); border-color: transparent; color: var(--warn); }
.crown { color: var(--gold); font-size: 30px; line-height: 1; animation: crown .7s .15s var(--spring) both; }
@keyframes crown { from { transform: translateY(-40px) rotate(-20deg); opacity: 0; } }
.offline { display: flex; align-items: center; gap: 10px; margin: 0; padding: 9px 12px; border-radius: 12px; background: var(--warn-soft); color: var(--warn); font-size: 14px; }
.spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.drop-enter-active, .drop-leave-active { transition: opacity .2s, transform .25s var(--ease); }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-6px); }

/* The moon (or any flourish) sweeps across, then fades. */
.flourish { position: fixed; inset: 0; z-index: 30; display: grid; place-content: center; justify-items: center; gap: 10px; pointer-events: auto; background: radial-gradient(circle at 50% 45%, rgba(8, 20, 16, .55), rgba(8, 20, 16, .2) 60%, transparent); }
.flourish .fg { font-size: 96px; line-height: 1; color: var(--gold); text-shadow: 0 0 40px rgba(226, 181, 90, .7); animation: sweep 1.6s var(--ease) both; }
.flourish b { font: 800 26px var(--f-display); color: #fff; text-shadow: 0 2px 12px rgba(0, 0, 0, .5); animation: rise .5s .35s var(--ease) both; }
@keyframes sweep { from { transform: translate(-60vw, 30px) rotate(-40deg) scale(.6); opacity: 0; } 55% { transform: translate(4vw, -6px) rotate(6deg) scale(1.1); opacity: 1; } }
.flourish-enter-active { transition: opacity .2s; }
.flourish-leave-active { transition: opacity .5s; }
.flourish-enter-from, .flourish-leave-to { opacity: 0; }
</style>
