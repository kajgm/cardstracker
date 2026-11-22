<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { gameUis } from '@cards/games/ui';
import { updateReady } from './socket';

const route = useRoute();
// Each game's accent colors its buttons and chips; the shell stays baize green.
const accentClass = computed(() => {
  const ui = gameUis[String(route.params.game ?? '')];
  return ui ? `g-${String(route.params.game)}` : '';
});
const reload = () => window.location.reload();
</script>

<template>
  <div :class="accentClass" class="app">
    <RouterView />
    <div v-if="updateReady" class="update" role="status">
      A new version of Cards is ready.
      <button type="button" class="btn" @click="reload">Reload</button>
    </div>
  </div>
</template>

<style scoped>
.app { min-height: 100%; }
.update { position: fixed; left: 50%; top: calc(64px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 20; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 14px; background: var(--ink); color: var(--bg); box-shadow: 0 8px 24px -8px var(--shadow); white-space: nowrap; }
.update .btn { min-height: 36px; }
</style>
