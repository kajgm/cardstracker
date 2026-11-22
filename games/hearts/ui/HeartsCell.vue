<script setup lang="ts">
import { computed } from 'vue';
import type { RoundView } from '@cards/engine';
import type { TablePlayer } from '@cards/ui';
import { moonShooter, type HeartsEntry } from '../rules';

// Points, with the Q♠ taker marked and a moon shown on the shooter's cell.
const props = defineProps<{ round: RoundView; player: TablePlayer }>();
const entry = computed(() => props.round.entry as Partial<HeartsEntry>);
const moon = computed(() => moonShooter(entry.value) === props.player.seat);
</script>

<template>
  <span v-if="round.complete">
    {{ round.points?.[player.side] }}<sup v-if="entry.queen === player.seat && !moon" class="q" title="Took the Q♠">♠</sup><span v-if="moon" class="moon" title="Shot the moon">☾</span>
  </span>
</template>

<style scoped>
.q { font: 700 10px/0 var(--f-body); color: var(--ink-3); margin-left: 1px; }
.moon { color: var(--gold); font: 600 14px/1 var(--f-body); margin-left: 2px; }
</style>
