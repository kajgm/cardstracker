import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Server as IoServer } from 'socket.io';
import { z } from 'zod';
import { computeStats } from '@cards/engine';
import { getGame } from '@cards/games';
import type { Db } from './db';
import * as store from './store';

export interface AppOptions {
  db: Db;
  /** Built client (client/dist). Not served when missing, e.g. in dev and tests. */
  clientDir?: string;
  version?: string;
  /** May export everything and purge games. */
  ownerEmail?: string;
  /** Stands in for the Access header when running locally. Never set it in the cluster. */
  devUserEmail?: string;
}

// cloudflared validates the Access JWT (access.required) and the NetworkPolicy only
// lets cloudflared reach this pod, so the header can be trusted here. Any LAN route
// added later must strip Cf-Access-* headers.
const ACCESS_HEADER = 'cf-access-authenticated-user-email';

const roundBody = z.object({ phase: z.string(), entry: z.unknown(), version: z.number().int() });
const newGameBody = z.object({
  type: z.string(),
  playerIds: z.array(z.number().int()),
  firstDealer: z.number().int().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export function createApp(opts: AppOptions): { http: HttpServer; io: IoServer } {
  const { db } = opts;
  const app = express();
  const http = createServer(app);
  const io = new IoServer(http, { serveClient: false });
  const version = opts.version ?? 'dev';

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  const userOf = (req: Request): string | undefined =>
    (req.header(ACCESS_HEADER) || opts.devUserEmail)?.toLowerCase();
  const isOwner = (req: Request) => !!opts.ownerEmail && userOf(req) === opts.ownerEmail.toLowerCase();
  const push = (game: store.GameDto) => io.to(`game:${game.id}`).emit('game:state', game);
  const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const r = schema.safeParse(value);
    if (!r.success) throw new store.ApiError(400, r.error.issues[0]?.message ?? 'Bad request');
    return r.data;
  };

  app.get('/healthz', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.type('text/plain').send('ok');
  });
  app.get('/version.json', (_req, res) => {
    res.set('Cache-Control', 'no-cache').json({ version });
  });

  const api = express.Router();
  api.get('/me', (req, res) => {
    const email = userOf(req);
    res.json({ email: email ?? null, player: store.playerForEmail(db, email) ?? null, owner: isOwner(req) });
  });
  api.get('/players', (_req, res) => {
    res.json(store.listPlayers(db));
  });
  api.post('/players', (req, res) => {
    const body = parse(z.object({ name: z.string(), email: z.string().email().optional() }), req.body);
    res.status(201).json(store.addPlayer(db, body.name, body.email));
  });
  api.get('/games', (req, res) => {
    const q = parse(
      z.object({ type: z.string().optional(), status: z.enum(['active', 'finished']).optional() }),
      req.query,
    );
    res.json(store.listGames(db, q));
  });
  api.post('/games', (req, res) => {
    res.status(201).json(store.createGame(db, parse(newGameBody, req.body), userOf(req)));
  });
  api.get('/games/:id', (req, res) => {
    res.json(store.getGameDto(db, req.params.id));
  });
  api.get('/games/:id/stats', (req, res) => {
    const dto = store.getGameDto(db, req.params.id);
    const rules = getGame(dto.type);
    res.json(rules ? computeStats(rules, store.stored(dto)) : []);
  });
  api.put('/games/:id/rounds/:n', (req, res) => {
    const body = parse(roundBody, req.body);
    const game = store.saveRound(db, req.params.id, Number(req.params.n), body, userOf(req));
    push(game);
    res.json(game);
  });
  api.delete('/games/:id/rounds/:n', (req, res) => {
    const { version: v } = parse(z.object({ version: z.coerce.number().int() }), req.query);
    const game = store.undoRound(db, req.params.id, Number(req.params.n), v);
    push(game);
    res.json(game);
  });
  api.post('/games/:id/end', (req, res) => {
    const { version: v } = parse(z.object({ version: z.number().int() }), req.body);
    const game = store.endGame(db, req.params.id, v);
    push(game);
    res.json(game);
  });
  api.delete('/games/:id/end', (req, res) => {
    const { version: v } = parse(z.object({ version: z.coerce.number().int() }), req.query);
    const game = store.resumeGame(db, req.params.id, v);
    push(game);
    res.json(game);
  });
  api.post('/games/:id/rematch', (req, res) => {
    res.status(201).json(store.rematch(db, req.params.id, userOf(req)));
  });
  api.delete('/games/:id', (req, res) => {
    if (!isOwner(req)) throw new store.ApiError(403, 'Only the owner can remove games');
    store.hideGame(db, req.params.id);
    res.status(204).end();
  });
  api.get('/records', (_req, res) => {
    res.json(store.records(db));
  });
  api.get('/stats/:type', (req, res) => {
    res.json(store.leaderboard(db, req.params.type));
  });
  api.get('/export', (req, res) => {
    if (!isOwner(req)) throw new store.ApiError(403, 'Only the owner can export');
    const ids = db.prepare('SELECT id FROM games ORDER BY created_at').all() as { id: string }[];
    res.json({
      exportedAt: new Date().toISOString(),
      players: store.listPlayers(db),
      games: ids.map(({ id }) => store.getGameDto(db, id)),
    });
  });
  api.use((_req, _res, next) => next(new store.ApiError(404, 'No such API route')));
  app.use('/api', api);

  if (opts.clientDir && existsSync(join(opts.clientDir, 'index.html'))) {
    const index = join(opts.clientDir, 'index.html');
    app.use(
      express.static(opts.clientDir, {
        index: false,
        setHeaders: (res, path) => {
          res.setHeader(
            'Cache-Control',
            path.includes(`${join('assets', '')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
          );
        },
      }),
    );
    // History-mode routes (/hearts, /tenone/p3x9m) all load the SPA.
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/socket.io')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  }

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    if (err instanceof store.ApiError) {
      res.status(err.status).json({ error: err.message, issues: err.issues, game: err.game });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'That request body is not valid JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  io.on('connection', (socket) => {
    socket.emit('app:version', version);
    socket.on('join', (id: unknown) => {
      if (typeof id === 'string' && /^[a-z0-9]{3,12}$/.test(id)) void socket.join(`game:${id}`);
    });
    socket.on('leave', (id: unknown) => {
      if (typeof id === 'string') void socket.leave(`game:${id}`);
    });
  });

  return { http, io };
}
