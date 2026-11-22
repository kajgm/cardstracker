<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: number | undefined; min?: number; max: number; label: string }>(), {
  min: 0,
});
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const set = (v: number) => emit('update:modelValue', Math.min(props.max, Math.max(props.min, v)));
</script>

<template>
  <span class="step" role="group" :aria-label="label">
    <button type="button" :disabled="(modelValue ?? 0) <= min" :aria-label="`Fewer for ${label}`" @click="set((modelValue ?? 0) - 1)">−</button>
    <b class="num" aria-live="polite">{{ modelValue ?? '–' }}</b>
    <button type="button" :disabled="(modelValue ?? 0) >= max" :aria-label="`More for ${label}`" @click="set((modelValue ?? min - 1) + 1)">+</button>
  </span>
</template>

<style scoped>
.step { display: inline-grid; grid-template-columns: 44px 36px 44px; align-items: center; height: 44px; border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; }
button { height: 100%; border: 0; background: var(--surface-2); color: var(--ink-2); font-size: 20px; cursor: pointer; }
button:disabled { color: var(--line-2); cursor: default; }
b { text-align: center; font: 700 22px/1 var(--f-num); }
</style>
