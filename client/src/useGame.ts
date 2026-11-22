import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { replay, type StoredGame } from '@cards/engine';
import { getGame } from '@cards/games';
import { gameUis } from '@cards/games/ui';
import { api, ApiError, type GameDto } from './api';
import { socket } from './socket';

/**
 * Loads a game, keeps it live through its Socket.IO room, replays it locally,
 * and saves with version checks. Every game screen uses this.
 */
export function useGame(id: Ref<string>) {
  const game = ref<GameDto>();
  const error = ref<string>();
  const notice = ref<string>();

  const rules = computed(() => (game.value ? getGame(game.value.type) : undefined));
  const ui = computed(() => (game.value ? gameUis[game.value.type] : undefined));
  const stored = computed<StoredGame | undefined>(() =>
    game.value
      ? { config: game.value.config, seats: game.value.players.length, firstDealer: game.value.firstDealer, rounds: game.value.rounds }
      : undefined,
  );
  const view = computed(() => (rules.value && stored.value ? replay(rules.value, stored.value) : undefined));

  const accept = (next: GameDto) => {
    if (next.id === id.value && (!game.value || next.version >= game.value.version)) game.value = next;
  };

  async function load() {
    error.value = undefined;
    try {
      accept(await api.game(id.value));
    } catch (err) {
      error.value = (err as Error).message;
    }
  }

  const join = () => socket.emit('join', id.value);
  socket.on('game:state', accept);
  socket.on('connect', join);
  watch(
    id,
    (now, before) => {
      if (before) socket.emit('leave', before);
      game.value = undefined;
      join();
      void load();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    socket.emit('leave', id.value);
    socket.off('game:state', accept);
    socket.off('connect', join);
  });

  /** Returns true when saved; on a conflict the newer game is shown and false returned. */
  async function run(action: (version: number) => Promise<GameDto>): Promise<boolean> {
    if (!game.value) return false;
    notice.value = undefined;
    try {
      accept(await action(game.value.version));
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.game) {
        game.value = err.game;
        notice.value = 'Someone else saved this game a moment ago. Check the sheet, then try again.';
      } else {
        notice.value = (err as Error).message;
      }
      return false;
    }
  }

  return {
    game,
    rules,
    ui,
    stored,
    view,
    error,
    notice,
    load,
    save: (n: number, phase: string, entry: unknown) =>
      run((version) => api.saveRound(id.value, n, { phase, entry, version })),
    undo: (n: number) => run((version) => api.undo(id.value, n, version)),
  };
}
