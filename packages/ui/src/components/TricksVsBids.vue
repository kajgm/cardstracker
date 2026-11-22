<script setup lang="ts">
import { computed } from 'vue';
import type { TablePlayer } from '../game-ui';
import Stepper from './Stepper.vue';
import SumCheck from './SumCheck.vue';

/** Tricks taken, starting at each bid so only the misses need changing. */
const props = defineProps<{
  players: TablePlayer[];
  order: number[];
  bids: number[];
  modelValue: number[];
  cards: number;
  /** Points per seat for this entry, or undefined until it adds up. */
  preview?: number[];
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();

const bySeat = computed(() => new Map(props.players.map((p) => [p.seat, p])));
const total = computed(() => props.modelValue.reduce((a, b) => a + (b ?? 0), 0));

function set(seat: number, value: number) {
  const next = [...props.modelValue];
  next[seat] = value;
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="tricks">
    <div class="head">
      <p class="lbl">Tricks taken</p>
      <SumCheck :value="total" :target="cards" noun="tricks" />
    </div>
    <div class="line hdr" aria-hidden="true"><span /><span>bid</span><span>took</span><span>pts</span></div>
    <div v-for="seat in order" :key="seat" class="line">
      <span class="who"><span class="dot" :style="{ '--c': `var(--${bySeat.get(seat)?.color})` }" />{{ bySeat.get(seat)?.name }}</span>
      <span class="b num">{{ bids[seat] }}</span>
      <Stepper :model-value="modelValue[seat]" :max="cards" :label="bySeat.get(seat)?.name ?? ''" @update:model-value="set(seat, $event)" />
      <span class="res num" :class="modelValue[seat] === bids[seat] ? 'ok' : 'miss'">{{ preview?.[seat] ?? '' }}</span>
    </div>
    <p class="mut hint">Everyone starts at their bid, so you only change the misses.</p>
  </div>
</template>

<style scoped>
.tricks { display: flex; flex-direction: column; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) 32px auto 40px; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); }
.hdr { padding: 0 0 4px; font: 600 10px var(--f-body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.hdr span:not(:first-child) { text-align: center; }
.hdr span:last-child { text-align: right; }
.who { display: flex; align-items: center; gap: 8px; font-weight: 500; white-space: nowrap; }
.b { text-align: center; font: 600 19px/1 var(--f-num); color: var(--ink-3); }
.res { text-align: right; font: 700 20px/1 var(--f-num); }
.ok { color: var(--good); }
.miss { color: var(--bad); }
.hint { margin: 8px 0 0; }
</style>
