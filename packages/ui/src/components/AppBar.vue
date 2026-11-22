<script setup lang="ts">
defineProps<{ title: string; back?: string; glyph?: string; glyphClass?: string; meta?: string[] }>();
</script>

<template>
  <header class="appbar">
    <div class="bar">
      <RouterLink v-if="back" :to="back" class="back" aria-label="Back">‹</RouterLink>
      <span v-if="glyph" class="mcard suit" :class="glyphClass">{{ glyph }}</span>
      <h1>{{ title }}</h1>
      <div class="end"><slot /></div>
    </div>
    <div v-if="meta?.length" class="meta">
      <span v-for="(m, i) in meta" :key="i">{{ m }}</span>
    </div>
  </header>
</template>

<style scoped>
.appbar { position: sticky; top: 0; z-index: 4; background: var(--felt); color: var(--felt-ink); padding-top: env(safe-area-inset-top); }
.bar { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 0 max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left)); max-width: 40rem; margin: 0 auto; }
h1 { font: 700 19px/1 var(--f-display); margin: 0; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.back { color: var(--felt-ink-2); font-size: 30px; line-height: 1; text-decoration: none; padding: 0 4px 4px 0; }
.suit { width: 24px; height: 32px; font-size: 15px; border: 0; }
.end { margin-left: auto; display: flex; gap: 8px; align-items: center; color: var(--felt-ink-2); font-size: 14px; }
.meta { background: var(--felt-2); color: var(--felt-ink-2); font-size: 13px; }
.meta { display: flex; gap: 6px 14px; flex-wrap: wrap; padding: 7px max(14px, env(safe-area-inset-right)) 7px max(14px, env(safe-area-inset-left)); }
.meta span:first-child { color: var(--felt-ink); font-weight: 600; }
</style>
