import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { backup, openDb } from './db';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const dataDir = resolve(process.env.DATA_DIR ?? './data');
const clientDir = resolve(process.env.CLIENT_DIR ?? '../client/dist');

mkdirSync(dataDir, { recursive: true });
const db = openDb(join(dataDir, 'cards.db'));
const { http, io } = createApp({
  db,
  clientDir,
  version: process.env.APP_VERSION,
  ownerEmail: process.env.OWNER_EMAIL,
  devUserEmail: process.env.DEV_USER_EMAIL,
});

// Nightly copy: checked hourly, written once per day, 14 kept on the same volume.
const runBackup = () => {
  try {
    const made = backup(db, join(dataDir, 'backups'));
    if (made) console.log(`backup written: ${made}`);
  } catch (err) {
    console.error('backup failed', err);
  }
};
runBackup();
const timer = setInterval(runBackup, 60 * 60 * 1000);

http.listen(port, () => console.log(`cardstracker ${process.env.APP_VERSION ?? 'dev'} on :${port}`));

const stop = () => {
  clearInterval(timer);
  io.close();
  http.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
