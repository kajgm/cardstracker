<script setup lang="ts">
import { computed } from 'vue';
import { BidChips, type EditorProps } from '@cards/ui';
import type { TenoneConfig, TenoneEntry } from '../rules';

const props = defineProps<EditorProps<TenoneEntry, TenoneConfig>>();
const emit = defineEmits<{ 'update:modelValue': [value: Partial<TenoneEntry>] }>();

const cards = computed(() => Number(props.info.cards));
const seats = computed(() => props.players.length);
/** From the dealer's left round to the dealer. */
const order = computed(() => Array.from({ length: seats.value }, (_, i) => (props.dealer + 1 + i) % seats.value));
const bids = computed(() => (props.modelValue.bids ?? []) as (number | null)[]);

// The hook: once everyone else has bid, the dealer can't make the total equal the cards dealt.
function forbidden(seat: number, all: (number | null)[]) {
  if (!props.config.hook || seat !== props.dealer) return undefined;
  const others = all.filter((b, s) => s !== seat);
  if (others.length < seats.value - 1 || others.some((b) => b === null || b === undefined)) return undefined;
  const value = cards.value - others.reduce<number>((a, b) => a + (b ?? 0), 0);
  if (value < 0 || value > cards.value) return undefined;
  const name = props.players.find((p) => p.seat === seat)?.name ?? 'The dealer';
  return { value, reason: `${name} can't bid ${value}: the bids would total ${cards.value}` };
}
</script>

<template>
  <p v-if="info.forehead" class="forehead">
    <b>Newfie poker.</b> Everyone holds their card to their forehead without looking and bids from the cards they can see.
  </p>
  <BidChips
    :players="players"
    :order="order"
    :model-value="bids"
    :max="cards"
    :forbidden="forbidden"
    @update:model-value="emit('update:modelValue', { ...modelValue, bids: $event as number[] })"
  />
</template>

<style scoped>
.forehead { margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); }
</style>
