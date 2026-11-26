<script setup lang="ts">
import { computed } from 'vue';
import type { RoundView } from '@cards/engine';
import type { TablePlayer } from '@cards/ui';
import { doubled, type SkyjoEntry } from '../rules';

// Points, with a mark on whoever went out: ✓ when it paid off, ×2 when it was doubled.
const props = defineProps<{ round: RoundView; player: TablePlayer }>();
const entry = computed(() => props.round.entry as SkyjoEntry);
const out = computed(() => entry.value.out === props.player.seat);
</script>

<template>
  <span v-if="round.complete">
    {{ round.points?.[player.side] }}<span v-if="out && doubled(entry)" class="m" title="Went out, doubled">×2</span><span v-else-if="out" class="m" title="Went out">✓</span>
  </span>
</template>

<style scoped>
.m { font: 600 12px/0 var(--f-body); color: var(--gold); margin-left: 2px; vertical-align: 5px; }
</style>
