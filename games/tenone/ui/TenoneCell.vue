<script setup lang="ts">
import { computed } from 'vue';
import type { RoundView } from '@cards/engine';
import type { TablePlayer } from '@cards/ui';
import type { TenoneEntry } from '../rules';

// Points over bid·took; a miss is red. While a hand is played, just the bid.
const props = defineProps<{ round: RoundView; player: TablePlayer }>();
const e = computed(() => props.round.entry as Partial<TenoneEntry>);
const bid = computed(() => e.value.bids?.[props.player.seat]);
const took = computed(() => e.value.tricks?.[props.player.seat]);
</script>

<template>
  <span v-if="round.complete" :class="{ zero: took !== bid }">
    {{ round.points?.[player.side] }}
    <small :class="took === bid ? 'made' : 'missed'">{{ bid }}·{{ took }}</small>
  </span>
  <span v-else-if="bid !== undefined" class="pending">bid {{ bid }}</span>
</template>

<style scoped>
small { display: block; margin-top: 2px; font: 500 11px/1 var(--f-body); }
.made { color: var(--good); }
.missed { color: var(--bad); }
.zero { color: var(--ink-3); }
.pending { font: 500 13px var(--f-body); }
</style>
