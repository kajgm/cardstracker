<script setup lang="ts">
import type { Component } from 'vue';
import type { RoundView } from '@cards/engine';
import type { TablePlayer } from '../game-ui';
import CountUp from './CountUp.vue';

defineProps<{
  players: TablePlayer[];
  rounds: RoundView[];
  totals: number[];
  /** Sides currently in first place. */
  leaders: number[];
  /** Seat dealing the next round, marked D. */
  dealer?: number;
  /** Game-specific cell; receives `round` and `player`. */
  cell?: Component;
  rowLabel?: (round: RoundView) => string;
  /** Key to the cell marks, shown under the grid. */
  legend?: string;
}>();
defineEmits<{ edit: [n: number] }>();
</script>

<template>
  <div class="panel grid-wrap">
    <table class="sg" :style="{ '--cols': players.length }">
      <thead>
        <tr>
          <th class="rc" />
          <th v-for="p in players" :key="p.seat">
            <span class="dot" :style="{ '--c': `var(--${p.color})` }" />{{ p.name }}<span v-if="p.seat === dealer" class="dl" title="Deals next">D</span>
          </th>
        </tr>
      </thead>
      <TransitionGroup tag="tbody" name="row">
        <tr
          v-for="r in rounds"
          :key="`${r.n}-${r.complete}`"
          :class="{ live: !r.complete }"
          tabindex="0"
          :aria-label="`Round ${r.n + 1}, tap to correct`"
          @click="$emit('edit', r.n)"
          @keydown.enter="$emit('edit', r.n)"
        >
          <td class="rc">{{ rowLabel ? rowLabel(r) : r.n + 1 }}</td>
          <td v-for="p in players" :key="p.seat">
            <component :is="cell" v-if="cell" :round="r" :player="p" />
            <template v-else>{{ r.points?.[p.side] ?? '' }}</template>
          </td>
        </tr>
        <tr v-if="!rounds.length" key="empty"><td class="empty" :colspan="players.length + 1">No rounds yet</td></tr>
      </TransitionGroup>
      <tfoot>
        <tr>
          <td class="rc">Total</td>
          <td v-for="p in players" :key="p.seat" :class="{ best: leaders.includes(p.side) && rounds.length }"><CountUp :value="totals[p.side]" /></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p v-if="legend" class="legend">{{ legend }}</p>
</template>

<style scoped>
.grid-wrap { overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.sg { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: calc(44px + var(--cols, 4) * 52px); }
th { padding: 9px 2px 7px; font: 600 12.5px var(--f-body); color: var(--ink-2); text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; }
th .dot { width: 8px; height: 8px; margin-right: 4px; }
td { padding: 7px 2px; text-align: center; font: 600 20px/1.1 var(--f-num); font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--line); }
tbody tr { cursor: pointer; }
@media (hover: hover) { tbody tr:hover td { background: var(--surface-2); } }
tbody tr:active td { background: var(--surface-2); }
/* The round column stays put while wide tables scroll sideways. */
.rc { position: sticky; left: 0; z-index: 1; background: var(--surface); }
.rc { width: 44px; padding-left: 10px; text-align: left; font: 500 12px/1.1 var(--f-body); color: var(--ink-3); }
tfoot td { border-bottom: 0; border-top: 2px solid var(--ink-2); font: 700 24px/1 var(--f-num); padding: 10px 2px; }
tfoot .rc { font: 600 13px var(--f-body); color: var(--ink-2); }
td.best { color: var(--gold); transition: color .4s; }
tr.live td { background: var(--accent-soft); font: 500 13px/1.2 var(--f-body); color: var(--ink-2); }
.legend { margin: -6px 2px 0; font-size: 12.5px; color: var(--ink-3); }
/* A newly saved round drops in and flashes. */
.row-enter-active { transition: transform .4s var(--spring), opacity .25s; }
.row-enter-active td { animation: flash 1.2s var(--ease); }
.row-enter-from { opacity: 0; transform: translateY(-10px); }
@keyframes flash { from { background: var(--accent-soft); } }
.empty { font: 400 14px var(--f-body); color: var(--ink-3); padding: 18px; }
.dl { display: inline-grid; place-items: center; width: 15px; height: 15px; margin-left: 3px; border-radius: 50%; background: var(--ink); color: var(--bg); font: 700 9px/1 var(--f-body); vertical-align: 1px; }
</style>
