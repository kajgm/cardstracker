import type { Issue, RoundInfo } from '@cards/engine';

// Mirrors server/src/store.ts. Kept as plain types so the client never imports server code.
export interface Player {
  id: number;
  name: string;
  color: string;
  email: string | null;
}
export interface SeatedPlayer extends Player {
  seat: number;
  side: number;
}
export interface GameDto {
  id: string;
  type: string;
  config: Record<string, unknown>;
  firstDealer: number;
  status: 'active' | 'finished' | 'hidden';
  version: number;
  createdBy: string | null;
  createdAt: string;
  finishedAt: string | null;
  endedEarly: boolean;
  players: SeatedPlayer[];
  rounds: { n: number; phase: string; entry: Record<string, unknown>; enteredBy: string | null }[];
}
export interface GameSummary {
  id: string;
  type: string;
  status: GameDto['status'];
  createdAt: string;
  finishedAt: string | null;
  /** UTC, SQLite format: 'YYYY-MM-DD HH:MM:SS'. */
  updatedAt: string;
  round: number;
  firstDealer: number;
  endedEarly: boolean;
  target: number | null;
  next: { n: number; info: RoundInfo; dealer: string } | null;
  players: { name: string; color: string; total: number; place: number }[];
}
export interface LeaderRow {
  playerId: number;
  name: string;
  color: string;
  played: number;
  won: number;
  avg: number | null;
  /** Places in the last five finished games, oldest first. */
  form: number[];
}
export interface RecordLine {
  label: string;
  value: string;
  name: string;
  color: string;
  gameId?: string;
  type?: string;
}
export interface StatLine {
  label: string;
  kind: 'count' | 'rate';
  values: number[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Issue[] = [],
    readonly game?: GameDto,
  ) {
    super(message);
  }
}

const GUEST_KEY = 'cards.guestName';
export function getGuestName(): string {
  try {
    return localStorage.getItem(GUEST_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setGuestName(name: string) {
  try {
    localStorage.setItem(GUEST_KEY, name.trim());
  } catch {
    // Private mode: the name just isn't remembered.
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const guest = getGuestName();
  // Encoded because header values must be ASCII; the server ignores it under an Access login.
  if (guest) headers['x-guest-name'] = encodeURIComponent(guest);
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.issues, data.game);
  return data as T;
}

export const api = {
  me: () =>
    call<{ email: string | null; guest: string | null; player: Player | null; owner: boolean }>('GET', '/me'),
  players: () => call<Player[]>('GET', '/players'),
  addPlayer: (name: string) => call<Player>('POST', '/players', { name }),
  games: (q: { type?: string; status?: 'active' | 'finished' } = {}) =>
    call<GameSummary[]>('GET', `/games?${new URLSearchParams(q as Record<string, string>)}`),
  createGame: (body: { type: string; playerIds: number[]; firstDealer: number; config: Record<string, unknown> }) =>
    call<GameDto>('POST', '/games', body),
  game: (id: string) => call<GameDto>('GET', `/games/${id}`),
  stats: (id: string) => call<StatLine[]>('GET', `/games/${id}/stats`),
  saveRound: (id: string, n: number, body: { phase: string; entry: unknown; version: number }) =>
    call<GameDto>('PUT', `/games/${id}/rounds/${n}`, body),
  undo: (id: string, n: number, version: number) => call<GameDto>('DELETE', `/games/${id}/rounds/${n}?version=${version}`),
  rematch: (id: string) => call<GameDto>('POST', `/games/${id}/rematch`),
  end: (id: string, version: number) => call<GameDto>('POST', `/games/${id}/end`, { version }),
  resume: (id: string, version: number) => call<GameDto>('DELETE', `/games/${id}/end?version=${version}`),
  /** One game's table, or 'all'. */
  leaderboard: (type: string) => call<LeaderRow[]>('GET', `/stats/${type}`),
  records: () => call<RecordLine[]>('GET', '/records'),
};
