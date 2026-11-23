/** A short vibration on phones that support it (Android); a no-op elsewhere. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw when vibration is blocked; it's only a nicety.
  }
}

/**
 * Keeps the screen on while a game is open, so phones don't lock between
 * hands. The browser drops the lock when the tab is hidden; it is taken
 * again when the tab comes back.
 */
export function useWakeLock() {
  let lock: WakeLockSentinel | undefined;
  let wanted = false;

  async function take() {
    if (!wanted || lock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = undefined));
    } catch {
      // Refused (battery saver, unsupported, not secure): the screen just sleeps as usual.
    }
  }
  const onVisible = () => void take();

  return {
    on() {
      wanted = true;
      document.addEventListener('visibilitychange', onVisible);
      void take();
    },
    off() {
      wanted = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
      lock = undefined;
    },
  };
}
