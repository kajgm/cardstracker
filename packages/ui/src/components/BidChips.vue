<script setup lang="ts">
import { computed } from 'vue';
import type { TablePlayer } from '../game-ui';

/**
 * Bids for "bid exactly" games (10-1, Oh Hell, Wizard). Players are listed in
 * bidding order; `forbidden` lets the game disable a value and say why
 * (10-1's dealer hook).
 */
const props = defineProps<{
  players: TablePlayer[];
  /** Seats in bidding order. */
  order: number[];
  modelValue: (number | null)[];
  max: number;
  forbidden?: (seat: number, bids: (number | null)[]) => { value: number; reason: string } | undefined;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: (number | null)[]] }>();

const bySeat = computed(() => new Map(props.players.map((p) => [p.seat, p])));
const values = computed(() => Array.from({ length: props.max + 1 }, (_, v) => v));
const total = computed(() => props.modelValue.reduce<number>((a, b) => a + (b ?? 0), 0));

function set(seat: number, value: number) {
  const next = props.players.map((p) => props.modelValue[p.seat] ?? null);
  next[seat] = value;
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="bids">
    <div class="head">
      <p class="lbl">Bids</p>
      <span class="sum-note">{{ total }} bid of {{ max }} {{ max === 1 ? 'card' : 'cards' }}</span>
    </div>
    <div v-for="(seat, i) in order" :key="seat" class="bid">
      <span class="who">
        <span class="dot" :style="{ '--c': `var(--${bySeat.get(seat)?.color})` }" />{{ bySeat.get(seat)?.name }}
        <span v-if="i === 0" class="mut">bids first</span>
        <span v-if="i === order.length - 1" class="mut">deals, bids last</span>
      </span>
      <div class="chips" role="radiogroup" :aria-label="`${bySeat.get(seat)?.name}'s bid`">
        <button
          v-for="v in values"
          :key="v"
          type="button"
          role="radio"
          class="chip"
          :class="{ on: modelValue[seat] === v }"
          :aria-checked="modelValue[seat] === v"
          :disabled="forbidden?.(seat, modelValue)?.value === v"
          @click="set(seat, v)"
        >
          {{ v }}
        </button>
      </div>
      <p v-if="forbidden?.(seat, modelValue)" class="why">{{ forbidden(seat, modelValue)!.reason }}</p>
    </div>
  </div>
</template>

<style scoped>
.bids { display: flex; flex-direction: column; }
.head { display: flex; justify-content: space-between; align-items: center; }
.sum-note { font: 600 13px var(--f-body); color: var(--ink-2); }
.bid { display: flex; flex-direction: column; gap: 6px; padding: 8px 0 10px; border-bottom: 1px solid var(--line); }
.who { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.why { margin: 0; font-size: 13px; color: var(--warn); }
</style>
