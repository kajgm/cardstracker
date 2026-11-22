# One image: Node serves the built SPA, /api and /socket.io.
#   docker build --build-arg APP_VERSION=1.0.0 -t cardstracker .
#   docker run -p 3000:3000 -v cards-data:/data cardstracker

# Build on the host's native arch. The server bundle is plain JavaScript (SQLite
# comes from node:sqlite, no native modules) and the client is static files, so
# the output is the same for every target platform.
FROM --platform=$BUILDPLATFORM node:26.13.1-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/ui/package.json packages/ui/
COPY games/package.json games/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run build

FROM node:26.13.1-alpine3.24
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    PORT=3000 \
    DATA_DIR=/data \
    CLIENT_DIR=/app/client
WORKDIR /app
COPY --from=build /app/server/dist/ ./
COPY --from=build /app/client/dist/ ./client/
# /data holds cards.db and backups/. Owned by `node` so a fresh volume is
# writable; the rest of the filesystem can stay read-only.
RUN mkdir /data && chown node:node /data
# Built-in non-root `node` user (uid 1000).
USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "server.cjs"]
