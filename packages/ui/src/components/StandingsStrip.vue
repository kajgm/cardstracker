<script setup lang="ts">
import CountUp from './CountUp.vue';

// Players in place order: when the order changes the boxes slide to their new spots.
defineProps<{
  entries: { key: string | number; name: string; color: string; total: number; place: number; progress?: number }[];
}>();
</script>

<template>
  <TransitionGroup tag="div" name="st" class="strip" :style="{ '--n': entries.length }">
    <div v-for="e in entries" :key="e.key" class="st" :class="{ lead: e.place === 1 }">
      <span class="nm"><span class="dot" :style="{ '--c': `var(--${e.color})` }" />{{ e.name }}</span>
      <span class="tot num"><CountUp :value="e.total" /><span v-if="e.place === 1" class="star" aria-label="Leading">★</span></span>
      <span v-if="e.progress !== undefined" class="prog"><i :style="{ width: `${Math.min(100, Math.max(0, e.progress * 100))}%` }" /></span>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.strip { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
.st { position: relative; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 8px 9px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; transition: border-color .3s, box-shadow .3s; }
.st.lead { border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
.nm { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--ink-2); white-space: nowrap; overflow: hidden; }
.nm .dot { width: 8px; height: 8px; }
.tot { font: 700 26px/1 var(--f-num); }
.star { display: inline-block; margin-left: 4px; color: var(--gold); font-size: 13px; vertical-align: 6px; animation: pop .5s var(--spring) both; }
@keyframes pop { from { transform: scale(0) rotate(-90deg); } 60% { transform: scale(1.5) rotate(10deg); } }
.prog { height: 4px; border-radius: 2px; background: var(--surface-2); overflow: hidden; }
.prog i { display: block; height: 100%; background: var(--ink-3); transition: width .6s var(--ease), background-color .3s; }
.lead .prog i { background: var(--gold); }
.st-move { transition: transform .5s var(--spring); }
</style>
