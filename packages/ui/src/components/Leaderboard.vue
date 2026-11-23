<script setup lang="ts">
import { computed } from 'vue';

export interface LeaderEntry {
  key: string | number;
  name: string;
  color: string;
  won: number;
  played: number;
  /** Average final score; shown when set (one game's table). */
  avg?: number | null;
  /** Places in the last five games, oldest first. */
  form: number[];
}

// Wins out of games played, the last five finishes (gold = a win), and on one
// game's page its average score. Rows arrive sorted; equal rows share a rank.
const props = defineProps<{ rows: LeaderEntry[]; showAvg?: boolean }>();

const ranked = computed(() => {
  const same = (a: LeaderEntry, b: LeaderEntry) =>
    a.won === b.won && (props.showAvg ? a.avg === b.avg : a.won / a.played === b.won / b.played);
  const ranks: number[] = [];
  props.rows.forEach((r, i) => ranks.push(i > 0 && same(props.rows[i - 1], r) ? ranks[i - 1] : i + 1));
  return props.rows.map((r, i) => ({ ...r, rank: ranks[i] }));
});
</script>

<template>
  <div class="panel lb">
    <div class="head" :class="{ avg: showAvg }">
      <span />
      <span>Player</span>
      <span>Wins</span>
      <span v-if="showAvg">Avg</span>
      <span class="fh">Last 5</span>
    </div>
    <TransitionGroup tag="ol" name="lb">
      <li v-for="r in ranked" :key="r.key" class="row" :class="{ avg: showAvg }">
        <span class="rk num">{{ r.rank }}</span>
        <span class="nm"><span class="dot" :style="{ '--c': `var(--${r.color})` }" />{{ r.name }}</span>
        <span class="wp"><b class="num">{{ r.won }}</b> of {{ r.played }}</span>
        <span v-if="showAvg" class="av num">{{ r.avg }}</span>
        <span class="form" :aria-label="`Last finishes: ${r.form.join(', ')}`">
          <i v-for="(p, i) in r.form" :key="i" :class="{ w: p === 1 }">{{ p }}</i>
        </span>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.lb ol { list-style: none; margin: 0; padding: 0; }
.head, .row { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto 104px; gap: 10px; align-items: center; padding: 0 12px; }
.head.avg, .row.avg { grid-template-columns: 16px minmax(0, 1fr) auto 40px 104px; }
.head { padding-top: 9px; padding-bottom: 5px; font: 600 10.5px var(--f-body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.head .fh { text-align: right; }
.row { padding-top: 9px; padding-bottom: 9px; border-top: 1px solid var(--line); font-size: 14.5px; }
.rk { font-size: 14px; color: var(--ink-3); text-align: center; }
.nm { display: inline-flex; align-items: center; gap: 7px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nm .dot { width: 8px; height: 8px; }
.wp { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; }
.wp b { font-size: 19px; font-weight: 700; color: var(--ink); margin-right: 2px; }
.av { font-size: 17px; font-weight: 600; text-align: right; }
.form { display: inline-flex; gap: 3px; justify-content: flex-end; }
.form i { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; background: var(--surface-2); color: var(--ink-3); font: 700 11.5px/1 var(--f-num); font-style: normal; }
.form i.w { background: var(--gold); color: var(--on-gold); }
.lb-move { transition: transform .45s var(--spring); }
.lb-enter-active { transition: opacity .3s var(--ease); }
.lb-enter-from { opacity: 0; }
</style>
