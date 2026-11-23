<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TablePlayer } from '../game-ui';
import Stepper from './Stepper.vue';
import SumCheck from './SumCheck.vue';

/**
 * Per-player counts that must add up to `total` (hearts in a hand, cribbage
 * points…). Once every player but one has been touched, the last one fills
 * itself in with what is left.
 */
const props = defineProps<{
  players: TablePlayer[];
  modelValue: number[];
  total: number;
  noun: string;
  /** Points shown beside each count, e.g. hearts + 13 for the queen. */
  preview?: (number | undefined)[];
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();

const touched = ref(new Set<number>(props.modelValue.map((v, s) => (v > 0 ? s : -1)).filter((s) => s >= 0)));
const autoSeat = ref<number | undefined>();
const sum = computed(() => props.modelValue.reduce((a, b) => a + (b ?? 0), 0));

function set(seat: number, value: number) {
  touched.value.add(seat);
  if (autoSeat.value === seat) autoSeat.value = undefined;
  const next = props.players.map((p) => props.modelValue[p.seat] ?? 0);
  next[seat] = value;
  const untouched = props.players.filter((p) => !touched.value.has(p.seat));
  if (untouched.length === 1) {
    const rest = props.total - next.reduce((a, b, s) => a + (s === untouched[0].seat ? 0 : b), 0);
    if (rest >= 0) {
      next[untouched[0].seat] = rest;
      autoSeat.value = untouched[0].seat;
    }
  }
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="cpp">
    <div class="head">
      <p class="lbl">{{ noun }} taken</p>
      <SumCheck :value="sum" :target="total" :noun="noun" />
    </div>
    <div v-for="p in players" :key="p.seat" class="line">
      <span class="who">
        <span class="dot" :style="{ '--c': `var(--${p.color})` }" />{{ p.name }}
        <span v-if="autoSeat === p.seat" class="auto">auto</span>
      </span>
      <Stepper :model-value="modelValue[p.seat]" :max="total" :label="p.name" @update:model-value="set(p.seat, $event)" />
      <span v-if="preview" class="pv num" :aria-label="`${preview[p.seat] ?? 0} points`">{{ preview[p.seat] ?? '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.cpp { display: flex; flex-direction: column; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) auto 40px; gap: 12px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); }
.who { display: flex; align-items: center; gap: 8px; font-weight: 500; white-space: nowrap; }
.auto { padding: 1px 5px; border: 1px dashed var(--line-2); border-radius: 5px; font: 600 12px var(--f-body); color: var(--ink-3); }
.pv { text-align: right; font: 700 20px/1 var(--f-num); }
</style>
