<script setup lang="ts">
import { SUIT_PATHS, type Suit } from '../suits';

// A suit drawn in SVG, sized by its container and colored by `currentColor`.
defineProps<{ suit: Suit }>();
</script>

<template>
  <svg class="suit-icon" viewBox="0 0 10 10" aria-hidden="true"><path :d="SUIT_PATHS[suit]" /></svg>
</template>

<style scoped>
.suit-icon { display: block; width: 1em; height: 1em; fill: currentColor; }
</style>
