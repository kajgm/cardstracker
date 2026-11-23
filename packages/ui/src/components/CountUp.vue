<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

// A number that counts to its new value instead of jumping. Instant with reduced motion.
const props = withDefaults(defineProps<{ value: number; ms?: number }>(), { ms: 600 });
const shown = ref(props.value);
let frame = 0;

const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

watch(
  () => props.value,
  (to, from) => {
    cancelAnimationFrame(frame);
    if (still() || from === undefined || to === from) {
      shown.value = to;
      return;
    }
    const start = performance.now();
    const base = shown.value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / props.ms);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.value = Math.round(base + (to - base) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  },
);
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <span>{{ shown }}</span>
</template>
