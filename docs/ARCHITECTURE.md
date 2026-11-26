# Cardstracker architecture

Score sheets for card games at `cards.kajgm.com/<game>`, for friends and family.
Hearts and 10-1 first; each later game is one folder. The full proposal with
diagrams and phone mockups: https://claude.ai/artifact/X2dkNWFerfcc8VScq5y36C
(private artifact).

## Shape

- One container: Node serves the built Vue SPA, the REST API under `/api` and
  Socket.IO under `/socket.io`. One SQLite file (`node:sqlite`, WAL) on a volume.
- `/<game>` is a client route looked up in the game registry. Adding a game
  never touches the deployment (DNS, proxy, network rules).
- Public, no sign-in. Each device picks a name, sent as `X-Guest-Name` and
  recorded as `guest:<name>` for "created by" / "entered by"; it grants nothing.
  Players are roster entries, not logins. Admin actions need `ADMIN_TOKEN`.

## Repository

| Path | Package | What it is |
|---|---|---|
| `packages/engine` | `@cards/engine` | The game contract (`defineGame`), `replay`, `checkSave`, stats. No Vue, no zod. |
| `packages/ui` | `@cards/ui` | Vue kit: AppBar, Felt, TitleCard, PlayingCard, Leaderboard, SuitIcon, StandingsStrip, ScoreGrid, Sheet, CountUp, Stepper, PlayerPick, CountPerPlayer, BidChips, TricksVsBids, RulesForm; `theme.css` tokens. |
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

`games/<id>/ui/index.ts` exports a `GameUi`: glyph, ink, accent, the title
card (`hand` of up to four cards, `blurb`, `facts`, `about`), one editor per
phase, optional score-grid cell and `legend`, optional `flourish` (an overlay
when a round lands, e.g. a moon), `startEntry`, `configFields`, `roundLabel`.
Editors are mostly kit components wired together.

## Look and motion

- Title cards: a hand of SVG-drawn cards on baize (`PlayingCard`: pips, a
  large suit on aces, a drawn bust on queens and kings). They deal in on load
  and fan out on press.
- Sheets spring up and close on a downward drag or flick. Saves are
  optimistic: the round lands at once and rolls back (sheet reopened) if the
  server refuses. New rows drop in, totals count up, standings slide to their
  new order, the leader's star pops.
- Phones: Wake Lock while a game is open, `navigator.vibrate` on save/undo
  (Android), 44px targets, no double-tap zoom delay, a pinned round column when
  the grid scrolls sideways, skeletons while loading, "Reconnecting…" while the
  socket is down. `prefers-reduced-motion` turns all of it off.

Adding a game: write `rules.ts` + `rules.test.ts`, write `ui/`, add one line
to `games/index.ts` and one to `games/ui.ts`, release.

## House rules as built

**Hearts**: 3–6 players, play to 100, lowest wins, ties share the win. 1 per
heart, 13 for the queen of spades. Moon (all 13 hearts + the queen) defaults to the shooter
choosing +26 to everyone else or −26 for themselves; can be fixed either way.
No jack of diamonds rule (removed Nov 2026; old configs still load). Passing: 4 players left/right/across/keep, otherwise
left/right/keep.

**10-1**: 3–7 players, 10 cards down to 1 (option: back up to 10), first hand
`min(10, ⌊51 ÷ players⌋)`. Bidding from the dealer's left; dealer hook on.
Exact bid scores 10 + bid, a miss 0 (option: 1 per trick, +10 if exact).
Option: Newfie poker on the 1-card hand (card on your forehead, bid without
looking); it changes the round label and editor hint, not the scoring.

**Skyjo**: 2–8 players, play to 100, lowest wins. Each round you pick who went
out and type each player's card total (cleared columns left out). Whoever went
out scores double unless their total is strictly the lowest, and only when it
is above zero.

## Home page

A felt header (lamp light drifting over faint suits) holds the wordmark, a
"N live" pill, a greeting and the games in progress as small scoreboards; a
game is live when a round was saved in the last 15 minutes. Below: "same table
again" (rematch of the last finished game), the game tiles, the leaderboard
(all games or one, with each player's last five finishes), the last game night
(two or more games finished the same evening; before 6am counts as the night
before, in the phone's time zone), records and recent games. One column on
phones, two from 900px. It refreshes every minute while open.

## Ending early

Any game with a complete round can be ended before its target or last hand
(`POST /api/games/:id/end`). `games.ended_early` is set; replay treats the
game as over after its last complete round and sets a half-entered round
aside. It counts like any finished game. `DELETE /api/games/:id/end` resumes
it.

## Data

Tables: `players`, `games` (config JSON, version), `seats`, `rounds`
(entry JSON, last phase saved), `results` (written at finish, rebuildable).
Totals are never stored: `replay()` derives them, on the server and on every
phone. Every write sends the version it was based on; a stale one gets `409`
plus the current game. Saves are pushed to the game's Socket.IO room.

Stats: `GET /api/stats/:type` (or `all`: wins and win rate across games,
no averages) and `GET /api/records` (win streak, each game's best final score,
each game's own stats summed; rate stats need 10 rounds).

Backups: once a day the server writes `VACUUM INTO /data/backups/cards-YYYY-MM-DD.db`
and keeps 14. `GET /api/export` dumps everything as JSON and `DELETE /api/games/:id`
hides a game; both need `Authorization: Bearer $ADMIN_TOKEN`.

## Deployment

- Release: Actions → Release on `main` (bump patch/minor/major from the latest
  tag, or an exact version) → `image.yml` → `ghcr.io/kajgm/cardstracker:X.Y.Z`
  and `:X.Y`.
- Run exactly one instance (SQLite has one writer, and live updates assume one
  Socket.IO server). It listens on :3000 as uid 1000, works with a read-only
  root filesystem plus a writable `/tmp`, and keeps its data on a volume at
  `/data`. It needs no outbound network.
- It is public: anyone with the URL can read and change games. Put a rate
  limit on non-GET `/api` requests at the edge to stop scripted flooding.
- Settings: `ADMIN_TOKEN` (export and remove games; unset means nobody can).
- Rows written before the site went public hold Access login emails in
  `created_by`/`entered_by`; the API returns only `guest:` labels.

## Where this differs from the proposal

- SQLite is Node's built-in `node:sqlite` with hand-written migrations, not
  better-sqlite3 + Drizzle: no native modules, so the image builds without a
  toolchain and the bundle runs on amd64 and arm64.
- Styling is plain CSS with the proposal's tokens (`packages/ui/src/theme.css`)
  and scoped component styles, not Tailwind. No Pinia: `useGame()` holds state.
- TypeScript is pinned to 6.0: vue-tsc does not run on TypeScript 7 yet.
