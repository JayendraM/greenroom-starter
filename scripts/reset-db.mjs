import { rmSync } from 'node:fs';

const dbPath = 'data/greenroom.db';

try {
  rmSync(dbPath, { force: true });
  console.log(`Removed ${dbPath} (if it existed).`);
} catch (err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
    console.error(
      `Could not delete the database (${dbPath}) — the file is in use.\n` +
        `Close the dev server (npm run dev) and any open SQLite viewer ` +
        `(Drizzle Studio, TablePlus, DBeaver, sqlite3 CLI), then try again.`,
    );
    process.exit(1);
  }
  console.error(`Could not delete ${dbPath}: ${err?.message ?? err}`);
  process.exit(1);
}
