import { computed, onBeforeUnmount, ref, toRaw, watch, type Ref } from 'vue';
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
      ? {
          config: game.value.config,
          seats: game.value.players.length,
          firstDealer: game.value.firstDealer,
          rounds: game.value.rounds,
          endedEarly: game.value.endedEarly,
        }
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

  /**
   * Returns true when saved; on a conflict the newer game is shown and false returned.
   * `optimistic` is applied to the sheet at once and rolled back if the server refuses.
   */
  async function run(action: (version: number) => Promise<GameDto>, optimistic?: (g: GameDto) => GameDto): Promise<boolean> {
    if (!game.value) return false;
    notice.value = undefined;
    const before = game.value;
    const guess = optimistic?.(before);
    if (guess) game.value = guess;
    try {
      accept(await action(before.version));
      return true;
    } catch (err) {
      // Roll back our own guess, never a newer state a socket pushed meanwhile.
      if (guess && toRaw(game.value) === guess) game.value = before;
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
    save: (n: number, phase: string, entry: Record<string, unknown>) =>
      run(
        (version) => api.saveRound(id.value, n, { phase, entry, version }),
        (g) => ({ ...g, rounds: [...g.rounds.filter((r) => r.n !== n), { n, phase, entry, enteredBy: null }].sort((a, b) => a.n - b.n) }),
      ),
    /** Ends the game now; the standings after the last complete round stand. */
    end: () => run((version) => api.end(id.value, version)),
    resume: () => run((version) => api.resume(id.value, version)),
    undo: (n: number) =>
      run(
        (version) => api.undo(id.value, n, version),
        (g) => ({ ...g, rounds: g.rounds.filter((r) => r.n !== n) }),
      ),
  };
}
