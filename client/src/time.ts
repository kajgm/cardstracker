import type { GameSummary } from './api';

/** The server stores UTC as SQLite text: 'YYYY-MM-DD HH:MM:SS'. */
export const fromSql = (s: string) => new Date(`${s.replace(' ', 'T')}Z`);

/** A game counts as live when a round was saved this recently. */
export const LIVE_MINUTES = 15;
export const isLive = (s: string, now = Date.now()) => now - fromSql(s).getTime() < LIVE_MINUTES * 60_000;

export function since(s: string, now = Date.now()): string {
  const min = Math.round((now - fromSql(s).getTime()) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
}

/** The evening a game belongs to, in local time: anything before 6am counts as the night before. */
export const nightOf = (s: string) => new Date(fromSql(s).getTime() - 6 * 3_600_000).toLocaleDateString('en-CA');

/** Finished games, newest first by when they finished. */
export const byFinish = (games: GameSummary[]) =>
  games.filter((g) => g.finishedAt).sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!));

/** The games of the most recent evening with any finished game. */
export function lastNight(finished: GameSummary[]): GameSummary[] {
  const sorted = byFinish(finished);
  if (!sorted.length) return [];
  const night = nightOf(sorted[0].finishedAt!);
  return sorted.filter((g) => nightOf(g.finishedAt!) === night).reverse();
}

/** "Ana, Theo and Mom" */
export const listNames = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
