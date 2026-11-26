<script setup lang="ts">
import { computed } from 'vue';
import { PlayerPick, type EditorProps } from '@cards/ui';
import skyjo, { type SkyjoConfig, type SkyjoEntry } from '../rules';

// Who went out, then each player's card total (cleared columns already left out).
const props = defineProps<EditorProps<SkyjoEntry, SkyjoConfig>>();
const emit = defineEmits<{ 'update:modelValue': [value: Partial<SkyjoEntry>] }>();

const cards = computed(() => (props.modelValue.cards ?? []) as (number | null)[]);
const set = (patch: Partial<SkyjoEntry>) => emit('update:modelValue', { ...props.modelValue, ...patch });
function setCards(seat: number, raw: string) {
  const next = props.players.map((p) => cards.value[p.seat] ?? null);
  const n = Number.parseInt(raw, 10);
  next[seat] = Number.isNaN(n) ? null : n;
  set({ cards: next as number[] });
}
// Phone number pads have no minus key.
const negate = (seat: number) => setCards(seat, String(-(cards.value[seat] ?? 0)));

const preview = computed(() => {
  const e = props.modelValue;
  if (e.out === undefined || cards.value.length !== props.players.length || cards.value.some((c) => c === null)) return undefined;
  return skyjo.score(e as SkyjoEntry, { config: props.config, seats: props.players.length, round: 0, dealer: 0, history: [] });
});
</script>

<template>
  <div class="grp">
    <p class="lbl">Who went out?</p>
    <PlayerPick :players="players" :model-value="modelValue.out" label="Who went out" @update:model-value="set({ out: $event })" />
  </div>
  <div class="grp">
    <p class="lbl">Card totals</p>
    <label v-for="p in players" :key="p.seat" class="line">
      <span class="who"><span class="dot" :style="{ '--c': `var(--${p.color})` }" />{{ p.name }}</span>
      <input
        type="text"
        inputmode="numeric"
        pattern="-?[0-9]*"
        enterkeyhint="next"
        :value="cards[p.seat] ?? ''"
        :aria-label="`Card total for ${p.name}`"
        @input="setCards(p.seat, ($event.target as HTMLInputElement).value)"
      />
      <button type="button" class="btn neg" :aria-label="`Flip sign for ${p.name}`" @click.prevent="negate(p.seat)">±</button>
      <span class="pv num" :class="{ dbl: preview && preview[p.seat] !== cards[p.seat] }">{{ preview?.[p.seat] ?? '' }}</span>
    </label>
  </div>
  <p class="mut">Whoever went out scores double unless their total is the lowest, and only when it is above zero.</p>
</template>

<style scoped>
.grp { display: flex; flex-direction: column; gap: 8px; }
.lbl { margin: 0; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) 72px 44px 40px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); }
.who { display: flex; align-items: center; gap: 8px; font-weight: 500; white-space: nowrap; }
input { width: 100%; min-height: 44px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); padding: 0 10px; text-align: center; font: 700 20px/1 var(--f-num); }
input:focus-visible { outline-offset: 0; border-color: var(--accent); }
.neg { min-height: 44px; padding: 0; font: 600 18px/1 var(--f-body); }
.pv { text-align: right; font: 700 20px/1 var(--f-num); }
.dbl { color: var(--accent); }
</style>
