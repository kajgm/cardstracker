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
    <form v-if="askName" class="guest" aria-labelledby="guest-title" @submit.prevent="saveName">
      <label id="guest-title" for="guest-name" class="title">Your name</label>
      <p class="mut">Shown next to the games and rounds you enter.</p>
      <input id="guest-name" v-model="guestInput" maxlength="24" placeholder="e.g. Jack" autocomplete="nickname" enterkeyhint="done" />
      <div class="acts">
        <button type="button" class="btn" @click="askName = false">Not now</button>
        <button type="submit" class="btn pri" :disabled="!guestInput.trim()">Save</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.app { min-height: 100%; }
.update { position: fixed; left: 50%; top: calc(64px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 20; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 14px; background: var(--ink); color: var(--bg); box-shadow: 0 8px 24px -8px var(--shadow); white-space: nowrap; }
.update .btn { min-height: 36px; }
.guest { position: fixed; left: max(16px, env(safe-area-inset-left)); right: max(16px, env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 20; max-width: 26rem; margin: 0 auto; display: grid; gap: 10px; padding: 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: 0 12px 32px -10px var(--shadow); }
.guest .title { font: 700 17px/1.2 var(--f-display); }
.guest .mut { margin: -6px 0 0; }
/* 16px keeps iOS from zooming the page on focus. */
.guest input { width: 100%; min-height: 46px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg); color: var(--ink); padding: 0 12px; font: 16px var(--f-body); }
.guest input::placeholder { color: var(--ink-3); }
.guest input:focus-visible { outline-offset: 0; border-color: var(--accent); }
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>
