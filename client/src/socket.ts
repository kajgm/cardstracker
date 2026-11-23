import { io } from 'socket.io-client';
import { ref } from 'vue';

/** One connection per tab, shared by every open game. */
export const socket = io({ transports: ['websocket', 'polling'] });

/** False while the live connection is down; the game screens say "Reconnecting". Starts true so a first load does not flash it. */
export const connected = ref(true);
socket.on('connect', () => (connected.value = true));
socket.on('disconnect', () => (connected.value = false));
socket.io.on('reconnect_attempt', () => (connected.value = false));

/** True once the server reports a different build than this page was loaded from. */
export const updateReady = ref(false);
socket.on('app:version', (version: string) => {
  if (version !== __APP_VERSION__ && version !== 'dev') updateReady.value = true;
});
