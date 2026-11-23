<script setup lang="ts">
import { computed } from 'vue';
import type { RoundView } from '@cards/engine';
import type { TablePlayer } from '@cards/ui';
import { moonShooter, type HeartsEntry } from '../rules';

// Points, with a crown on whoever took the queen of spades and a moon shown on the shooter's cell.
const props = defineProps<{ round: RoundView; player: TablePlayer }>();
const entry = computed(() => props.round.entry as Partial<HeartsEntry>);
const moon = computed(() => moonShooter(entry.value) === props.player.seat);
</script>

<template>
  <span v-if="round.complete">
    {{ round.points?.[player.side] }}<span v-if="entry.queen === player.seat && !moon" class="q" title="Took the queen of spades">♛</span><span v-if="moon" class="moon" title="Shot the moon">☾</span>
  </span>
</template>

<style scoped>
.q { font: 400 12px/0 var(--f-body); color: var(--gold); margin-left: 2px; vertical-align: 5px; }
.moon { color: var(--gold); font: 600 14px/1 var(--f-body); margin-left: 2px; }
</style>
