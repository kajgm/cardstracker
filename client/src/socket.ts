import { io } from 'socket.io-client';
import { ref } from 'vue';

/** One connection per tab, shared by every open game. */
export const socket = io({ transports: ['websocket', 'polling'] });

/** True once the server reports a different build than this page was loaded from. */
export const updateReady = ref(false);
socket.on('app:version', (version: string) => {
  if (version !== __APP_VERSION__ && version !== 'dev') updateReady.value = true;
});
