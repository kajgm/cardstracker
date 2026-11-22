# Cardstracker architecture

Score sheets for card games at `cards.kajgm.com/<game>`, for friends and family.
Hearts and 10-1 first; each later game is one folder. The full proposal with
diagrams and phone mockups: https://claude.ai/artifact/X2dkNWFerfcc8VScq5y36C
(private artifact).

## Shape

- One container: Node serves the built Vue SPA, the REST API under `/api` and
  Socket.IO under `/socket.io`. One SQLite file (`node:sqlite`, WAL) on a PVC.
- `/<game>` is a client route looked up in the game registry. Adding a game
  never touches DNS, Access, cloudflared, NetworkPolicies or ArgoCD.
- Sign-in is Cloudflare Access (group `friends` + owner) in front of a
  tunnel-only route. The server reads `Cf-Access-Authenticated-User-Email`
  for "entered by"; it grants nothing. Players are roster entries, not logins.
  No guest/bypass access (decided Nov 2026). No LAN route: no internet means no
  app, which is accepted.

## Repository

| Path | Package | What it is |
|---|---|---|
| `packages/engine` | `@cards/engine` | The game contract (`defineGame`), `replay`, `checkSave`, stats. No Vue, no zod. |
| `packages/ui` | `@cards/ui` | Vue kit: AppBar, StandingsStrip, ScoreGrid, Sheet, Stepper, PlayerPick, CountPerPlayer, BidChips, TricksVsBids, RulesForm; `theme.css` tokens. |
| `games/` | `@cards/games` | `index.ts` rules registry (server + client), `ui.ts` UI registry (client only), one folder per game. |
| `server/` | `@cards/server` | Express 5, Socket.IO, SQLite, backups. Bundled by esbuild into `dist/server.cjs`. |
| `client/` | `@cards/client` | Vite SPA: `/`, `/:game`, `/:game/new`, `/:game/:id`. |

The import boundary matters: the server imports `@cards/games` (rules only)
and never `@cards/games/ui`.

## A game

`games/<id>/rules.ts` exports `defineGame({...})`:

- `players`, `lowWins`, optional `teams()` (seat → side; scores are kept per side)
- `config`: zod schema + `defaults(seats)` for house rules
- `entry`: zod schema accepting a round part-way through its phases
- `phases`: e.g. Hearts `[result]`, 10-1 `[bids, tricks]`; each has `validate()`
- `roundInfo(ctx)`, `score(entry, ctx)`, `isOver(progress)`, optional `stats`

`games/<id>/ui/index.ts` exports a `GameUi`: glyph, ink, accent, one editor
per phase, optional score-grid cell, `startEntry`, `configFields`,
`roundLabel`. Editors are mostly kit components wired together.

Adding a game: write `rules.ts` + `rules.test.ts`, write `ui/`, add one line
to `games/index.ts` and one to `games/ui.ts`, release.

## House rules as built

**Hearts**: 3–6 players, play to 100, lowest wins, ties share the win. 1 per
heart, 13 for the Q♠. Moon (all 13 hearts + Q♠) defaults to the shooter
choosing +26 to everyone else or −26 for themselves; can be fixed either way.
Optional J♦ −10. Passing: 4 players left/right/across/keep, otherwise
left/right/keep.

**10-1**: 3–7 players, 10 cards down to 1 (option: back up to 10), first hand
`min(10, ⌊51 ÷ players⌋)`. Bidding from the dealer's left; dealer hook on.
Exact bid scores 10 + bid, a miss 0 (option: 1 per trick, +10 if exact).
Option: Newfie poker on the 1-card hand (card on your forehead, bid without
looking); it changes the round label and editor hint, not the scoring.

## Data

Tables: `players`, `games` (config JSON, version), `seats`, `rounds`
(entry JSON, last phase saved), `results` (written at finish, rebuildable).
Totals are never stored: `replay()` derives them, on the server and on every
phone. Every write sends the version it was based on; a stale one gets `409`
plus the current game. Saves are pushed to the game's Socket.IO room.

Backups: once a day the server writes `VACUUM INTO /data/backups/cards-YYYY-MM-DD.db`
and keeps 14. Owner-only `GET /api/export` dumps everything as JSON
(`OWNER_EMAIL`).

## Deployment (kajgm homelab, not done yet)

Like stocktracker, minus moving parts:

- Release: Actions → Release (`X.Y.Z`) → `image.yml` → `ghcr.io/kajgm/cardstracker:X.Y.Z` and `:X.Y`.
- `k8s/apps/cardstracker/` in kajgm/homelab: namespace, Deployment (1 replica,
  Recreate, uid 1000, :3000, readOnlyRootFilesystem + `/tmp` emptyDir, `/data`
  PVC `local-path-retain`), Service `cardstracker:80 → 3000`, default-deny
  NetworkPolicy (in: cloudflared → 3000; out: none). No HTTPRoute, no
  ExternalSecret.
- Allowlists: `apps` AppProject destinations and `k8s/apps/kustomization.yaml`
  only. cloudflared: ingress rule with `access.required` + egress to port 3000.
- Access app `cards.kajgm.com`, session 1 month, group `friends` + owner, then
  `cloudflared tunnel route dns homelab cards.kajgm.com`.

## Where this differs from the proposal

- SQLite is Node's built-in `node:sqlite` with hand-written migrations, not
  better-sqlite3 + Drizzle: no native modules, so the image builds without a
  toolchain and the bundle runs on amd64 and arm64.
- Styling is plain CSS with the proposal's tokens (`packages/ui/src/theme.css`)
  and scoped component styles, not Tailwind. No Pinia: `useGame()` holds state.
- TypeScript is pinned to 6.0: vue-tsc does not run on TypeScript 7 yet.
