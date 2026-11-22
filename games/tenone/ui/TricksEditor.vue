<script setup lang="ts">
import { computed } from 'vue';
import { TricksVsBids, type EditorProps } from '@cards/ui';
import tenone, { type TenoneConfig, type TenoneEntry } from '../rules';

const props = defineProps<EditorProps<TenoneEntry, TenoneConfig>>();
const emit = defineEmits<{ 'update:modelValue': [value: Partial<TenoneEntry>] }>();

const cards = computed(() => Number(props.info.cards));
const seats = computed(() => props.players.length);
const order = computed(() => Array.from({ length: seats.value }, (_, i) => (props.dealer + 1 + i) % seats.value));
const bids = computed(() => props.modelValue.bids ?? []);
const tricks = computed(() => props.modelValue.tricks ?? [...bids.value]);
const preview = computed(() =>
  tenone.score({ bids: bids.value, tricks: tricks.value }, { config: props.config, seats: seats.value, round: 0, dealer: 0, history: [] }),
);
</script>

<template>
  <TricksVsBids
    :players="players"
    :order="order"
    :bids="bids"
    :model-value="tricks"
    :cards="cards"
    :preview="preview"
    @update:model-value="emit('update:modelValue', { ...modelValue, tricks: $event })"
  />
</template>
