<script setup lang="ts">
import type { RecordLine } from '../api';

// All-time bests. A record from one game opens that game.
defineProps<{ records: RecordLine[] }>();
</script>

<template>
  <div class="recs">
    <component
      :is="r.gameId ? 'RouterLink' : 'div'"
      v-for="r in records"
      :key="r.label"
      :to="r.gameId ? `/${r.type}/${r.gameId}` : undefined"
      class="panel rec"
    >
      <span class="rl">{{ r.label }}</span>
      <b class="rv num">{{ r.value }}</b>
      <span class="rh"><span class="dot" :style="{ '--c': `var(--${r.color})` }" />{{ r.name }}</span>
    </component>
  </div>
</template>

<style scoped>
.recs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.rec { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 12px 11px; color: var(--ink); text-decoration: none; }
.rl { font: 600 12px/1.3 var(--f-body); color: var(--ink-3); }
.rv { font-size: 30px; font-weight: 700; line-height: 1; }
.rh { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); }
.rh .dot { width: 8px; height: 8px; }
</style>
