<script setup lang="ts">
import type { Component } from 'vue';
import type { RoundView } from '@cards/engine';
import type { TablePlayer } from '../game-ui';

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
      <tbody>
        <tr
          v-for="r in rounds"
          :key="r.n"
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
        <tr v-if="!rounds.length"><td class="empty" :colspan="players.length + 1">No rounds yet</td></tr>
      </tbody>
      <tfoot>
        <tr>
          <td class="rc">Total</td>
          <td v-for="p in players" :key="p.seat" :class="{ best: leaders.includes(p.side) && rounds.length }">{{ totals[p.side] }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.grid-wrap { overflow-x: auto; }
.sg { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: calc(44px + var(--cols, 4) * 52px); }
th { padding: 9px 2px 7px; font: 600 12.5px var(--f-body); color: var(--ink-2); text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; }
th .dot { width: 8px; height: 8px; margin-right: 4px; }
td { padding: 7px 2px; text-align: center; font: 600 20px/1.1 var(--f-num); font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--line); }
tbody tr { cursor: pointer; }
tbody tr:hover td { background: var(--surface-2); }
.rc { width: 44px; padding-left: 10px; text-align: left; font: 500 12px/1.1 var(--f-body); color: var(--ink-3); }
tfoot td { border-bottom: 0; border-top: 2px solid var(--ink-2); font: 700 24px/1 var(--f-num); padding: 10px 2px; }
tfoot .rc { font: 600 11px var(--f-body); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-2); }
td.best { color: var(--gold); }
tr.live td { background: var(--accent-soft); font: 500 13px/1.2 var(--f-body); color: var(--ink-2); }
.empty { font: 400 14px var(--f-body); color: var(--ink-3); padding: 18px; }
.dl { display: inline-grid; place-items: center; width: 15px; height: 15px; margin-left: 3px; border-radius: 50%; background: var(--ink); color: var(--bg); font: 700 9px/1 var(--f-body); vertical-align: 1px; }
</style>
