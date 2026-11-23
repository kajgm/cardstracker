# cardstracker

Score sheets for card games at `cards.kajgm.com/<game>`: Hearts and 10-1 so far.
Phones at the table share one live sheet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Develop

Needs Node 26 (`.nvmrc`).

```sh
npm install
cp server/.env.template server/.env   # sets DEV_USER_EMAIL in place of Cloudflare Access
npm run dev:server                    # API + sockets on :3000, data in server/data/
npm run dev:client                    # Vite on :5173, proxies /api and /socket.io
```

```sh
npm test           # engine, game rules and API tests (vitest)
npm run typecheck  # tsc for shared code and server, vue-tsc for the client
npm run build      # client/dist + server/dist/server.cjs
npm start          # serve the build on :3000
```

## Add a game

1. `games/<id>/rules.ts` with `defineGame()` and `rules.test.ts` with real hands.
2. `games/<id>/ui/`: one editor per phase, usually kit components from `@cards/ui`,
   and the title card (`hand`, `blurb`, `facts`, `about`).
3. One line in `games/index.ts`, one in `games/ui.ts`.

The route `/<id>`, the API, storage, stats and live updates need no changes.

## Release

Actions → **Release** on `main`: pick `patch`, `minor` or `major` to bump the
latest tag, or type an exact version. It tags the commit, publishes a GitHub
release with generated notes and builds `ghcr.io/kajgm/cardstracker:X.Y.Z` and
`:X.Y`. Deploying it is a tag bump in kajgm/homelab.
