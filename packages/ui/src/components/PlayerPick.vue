<script setup lang="ts">
import type { TablePlayer } from '../game-ui';

defineProps<{ players: TablePlayer[]; modelValue: number | undefined; label: string }>();
defineEmits<{ 'update:modelValue': [seat: number] }>();
</script>

<template>
  <div class="pick" role="radiogroup" :aria-label="label">
    <button
      v-for="p in players"
      :key="p.seat"
      type="button"
      role="radio"
      :aria-checked="modelValue === p.seat"
      class="pk"
      :class="{ on: modelValue === p.seat }"
      @click="$emit('update:modelValue', p.seat)"
    >
      <span class="dot" :style="{ '--c': `var(--${p.color})` }" />{{ p.name }}
    </button>
  </div>
</template>

<style scoped>
.pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); gap: 6px; }
.pk { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface); font-weight: 500; cursor: pointer; }
.pk.on { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.pk.on .dot { box-shadow: 0 0 0 2px var(--on-accent); }
</style>
