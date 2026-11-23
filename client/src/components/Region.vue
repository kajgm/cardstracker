<script setup lang="ts">
// A home page section that loads data, in all four states: a skeleton while
// loading, what broke with a retry, an empty note saying what will appear, or the content.
defineProps<{ title: string; state: 'loading' | 'error' | 'empty' | 'full'; skeleton?: number }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="region" :aria-busy="state === 'loading'">
    <div class="head">
      <h2 class="lbl">{{ title }}</h2>
      <slot v-if="state === 'full' || state === 'empty'" name="tools" />
    </div>
    <div v-if="state === 'loading'" class="skel" :style="{ height: `${skeleton ?? 160}px` }" />
    <p v-else-if="state === 'error'" class="note err">
      Couldn't load this. Check the connection, then
      <button type="button" class="retry" @click="$emit('retry')">try again</button>.
    </p>
    <p v-else-if="state === 'empty'" class="note"><slot name="empty" /></p>
    <slot v-else />
  </section>
</template>

<style scoped>
.region { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; min-height: 32px; }
.note { margin: 0; padding: 16px; border: 1px dashed var(--line-2); border-radius: 14px; color: var(--ink-2); font-size: 14px; line-height: 1.5; }
.note.err { border-style: solid; border-color: transparent; background: var(--bad-soft); color: var(--bad); }
.retry { border: 0; padding: 0; background: none; color: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; min-height: 24px; }
.retry:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
</style>
