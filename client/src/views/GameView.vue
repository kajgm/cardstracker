<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { phaseIssues, roundContext, type RoundView } from '@cards/engine';
import { AppBar, ScoreGrid, Sheet, StandingsStrip, type TablePlayer } from '@cards/ui';
import { api, type StatLine } from '../api';
import { useGame } from '../useGame';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const { game, rules, ui, stored, view, error, notice, save, undo } = useGame(id);

const players = computed<TablePlayer[]>(() => game.value?.players ?? []);
const nameOf = (seat: number) => players.value.find((p) => p.seat === seat)?.name ?? '';
const sideName = (side: number) =>
  players.value.filter((p) => p.side === side).map((p) => p.name).join(' & ');
const target = computed(() => (typeof game.value?.config.target === 'number' ? game.value.config.target : undefined));

const meta = computed(() => {
  const v = view.value;
  if (!v || !ui.value) return [];
  if (v.over) return ['Final', `${v.rounds.length} rounds`];
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
const saving = ref(false);

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

async function submit() {
  if (!draft.value) return;
  saving.value = true;
  const ok = await save(draft.value.n, draft.value.phase, draft.value.entry);
  saving.value = false;
  if (ok) draft.value = undefined;
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
  await undo(lastRound.value.n);
}

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
    <p v-if="notice" class="error" role="alert">{{ notice }}</p>

    <template v-if="game && view">
      <section v-if="view.over" class="panel final">
        <span class="crown" aria-hidden="true">♛</span>
        <b>{{ winners }} {{ view.winners.length > 1 ? 'tie for the win' : 'wins' }}</b>
        <span class="mut">{{ view.rounds.length }} rounds</span>
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
        @edit="correct"
      />
      <p class="mut">Tap a round to correct it.</p>

      <template v-if="view.over && stats.length">
        <h2 class="lbl">This game</h2>
        <div class="panel">
          <div v-for="s in stats" :key="s.label" class="row">
            <span class="grow">{{ s.label }}</span><span class="mut">{{ statText(s) }}</span>
          </div>
        </div>
      </template>
    </template>
  </main>

  <div v-if="game && view" class="actionbar">
    <button v-if="lastRound" type="button" class="btn" @click="undoLast">
      {{ armedUndo ? `Undo round ${lastRound.n + 1}?` : 'Undo' }}
    </button>
    <button v-if="view.next" type="button" class="btn pri" @click="enterNext">
      {{ phaseLabel(view.next.phase) }} · round {{ view.next.n + 1 }}
    </button>
    <button v-else type="button" class="btn pri" @click="rematch">Rematch · {{ nameOf((game.firstDealer + 1) % players.length) }} deals</button>
  </div>

  <Sheet
    v-if="draft && draftRound && ui && game"
    :title="draft.correcting ? `Correct round ${draft.n + 1}` : `${phaseLabel(draft.phase)} · round ${draft.n + 1}`"
    :subtitle="ui.roundLabel(draftRound.info, nameOf(draftRound.ctx.dealer))"
    :issues="issues"
    :saving="saving"
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
.crown { color: var(--gold); font-size: 30px; line-height: 1; }
</style>
