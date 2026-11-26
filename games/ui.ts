// Client-only registry: each game's screens. Keep the keys in step with ./index.ts.
import type { GameUi } from '@cards/ui';
import hearts from './hearts/ui';
import tenone from './tenone/ui';
import skyjo from './skyjo/ui';

export const gameUis: Record<string, GameUi> = { hearts, tenone, skyjo };
