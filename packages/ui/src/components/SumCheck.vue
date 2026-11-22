<script setup lang="ts">
defineProps<{ value: number; target: number; noun: string }>();
</script>

<template>
  <span class="sum" :class="value === target ? 'ok' : 'warn'">
    {{ value }} of {{ target }} {{ noun }}<template v-if="value === target"> ✓</template>
  </span>
</template>

<style scoped>
.sum { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font: 600 13px var(--f-body); white-space: nowrap; }
.ok { background: var(--good-soft); color: var(--good); }
.warn { background: var(--warn-soft); color: var(--warn); }
</style>
