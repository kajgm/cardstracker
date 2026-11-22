// The one list of games. Imported by the server and the client; it holds
// rules only, so the server never loads Vue code. Screens are in ./ui.ts.
import type { AnyGameRules } from '@cards/engine';
import hearts from './hearts/rules';
import tenone from './tenone/rules';

export const games: Record<string, AnyGameRules> = { hearts, tenone };

export function getGame(id: string): AnyGameRules | undefined {
  return Object.hasOwn(games, id) ? games[id] : undefined;
}
