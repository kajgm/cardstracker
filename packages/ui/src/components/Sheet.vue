<script setup lang="ts">
import type { Issue } from '@cards/engine';

defineProps<{ title: string; subtitle?: string; issues: Issue[]; saving?: boolean; saveLabel: string }>();
defineEmits<{ save: []; close: [] }>();
</script>

<template>
  <div class="scrim" @click.self="$emit('close')">
    <section class="sheet" role="dialog" aria-modal="true" :aria-label="title">
      <span class="grab" />
      <header>
        <h2>{{ title }}</h2>
        <span v-if="subtitle" class="mut">{{ subtitle }}</span>
        <button type="button" class="x" aria-label="Close" @click="$emit('close')">×</button>
      </header>
      <div class="body"><slot /></div>
      <p v-if="issues.length" class="issue" role="status">{{ issues[0].message }}</p>
      <button type="button" class="btn pri" :disabled="!!issues.length || saving" @click="$emit('save')">
        {{ saving ? 'Saving…' : saveLabel }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 10; background: var(--scrim); display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 40rem; max-height: 92dvh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 10px max(16px, env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: var(--surface); border-radius: 22px 22px 0 0; box-shadow: 0 -12px 30px -12px var(--shadow); }
.grab { width: 40px; height: 4px; border-radius: 2px; background: var(--line-2); align-self: center; }
header { display: flex; align-items: baseline; gap: 10px; }
h2 { font: 700 19px var(--f-display); margin: 0; }
.x { margin-left: auto; border: 0; background: none; font-size: 26px; line-height: 1; color: var(--ink-3); cursor: pointer; }
.body { display: flex; flex-direction: column; gap: 14px; }
.issue { margin: 0; padding: 8px 12px; border-radius: 10px; background: var(--warn-soft); color: var(--warn); font-size: 14px; }
</style>
