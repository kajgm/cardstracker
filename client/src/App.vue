<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { gameUis } from '@cards/games/ui';
import { updateReady } from './socket';
import { getGuestName, setGuestName } from './api';

// No logins: ask once for a name to record who entered what.
const guestInput = ref(getGuestName());
const askName = ref(!guestInput.value);
function saveName() {
  if (!guestInput.value.trim()) return;
  setGuestName(guestInput.value);
  askName.value = false;
}

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
    <form v-if="askName" class="guest" @submit.prevent="saveName">
      <label for="guest-name">Your name</label>
      <input id="guest-name" v-model="guestInput" maxlength="24" placeholder="So we know who scored" autocomplete="nickname" />
      <button type="submit" class="btn" :disabled="!guestInput.trim()">Save</button>
      <button type="button" class="btn"@click="askName = false">Not now</button>
    </form>
  </div>
</template>

<style scoped>
.app { min-height: 100%; }
.update { position: fixed; left: 50%; top: calc(64px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 20; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 14px; background: var(--ink); color: var(--bg); box-shadow: 0 8px 24px -8px var(--shadow); white-space: nowrap; }
.update .btn { min-height: 36px; }
.guest { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 20; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 520px; margin: 0 auto; padding: 8px 8px 8px 16px; border-radius: 14px; background: var(--ink); color: var(--bg); box-shadow: 0 8px 24px -8px var(--shadow); }
.guest input { flex: 1 1 140px; min-width: 0; min-height: 36px; }
.guest .btn { min-height: 36px; }
</style>
