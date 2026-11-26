// The one list of games. Imported by the server and the client; it holds
// rules only, so the server never loads Vue code. Screens are in ./ui.ts.
import type { AnyGameRules } from '@cards/engine';
import hearts from './hearts/rules';
import tenone from './tenone/rules';
import skyjo from './skyjo/rules';

export const games: Record<string, AnyGameRules> = { hearts, tenone, skyjo };

export function getGame(id: string): AnyGameRules | undefined {
  return Object.hasOwn(games, id) ? games[id] : undefined;
}
