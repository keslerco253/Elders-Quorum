import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { migrations } from "./migrations";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

type DB = Database.Database;

const globalForDb = globalThis as unknown as { __eqDb?: DB };

function open(): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function migrate(db: DB, upTo = Infinity) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
  const done = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((r) => (r as { id: number }).id));
  for (const m of migrations) {
    if (done.has(m.id) || m.id > upTo) continue;
    const fkWasOn = db.pragma("foreign_keys", { simple: true }) === 1;
    if (m.fkOff) db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        db.exec(m.sql);
        if (m.fkOff && db.prepare("PRAGMA foreign_key_check").all().length) throw new Error(`migration ${m.id} left broken references`);
        db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(m.id);
      })();
    } finally {
      if (m.fkOff && fkWasOn) db.pragma("foreign_keys = ON");
    }
  }
}

export function db(): DB {
  if (!globalForDb.__eqDb) globalForDb.__eqDb = open();
  return globalForDb.__eqDb;
}

/**
 * Swaps in another database file (restoring a backup). Runs synchronously so
 * nothing else touches the database while the files are switched.
 */
export function replaceDatabase(incoming: string) {
  const file = path.join(DATA_DIR, "app.db");
  if (globalForDb.__eqDb?.open) globalForDb.__eqDb.close();
  globalForDb.__eqDb = undefined;
  for (const f of [file + "-wal", file + "-shm"]) fs.rmSync(f, { force: true });
  fs.renameSync(incoming, file);
  db();
}

/**
 * Use an in-memory database (tests). legacySeed is SQL run on the schema from
 * before wards and organizations (one "ward" per quorum, roles on members),
 * then migrated, so tests can set up people simply and the migration is
 * exercised every time.
 */
export function useTestDb(legacySeed?: string): DB {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  if (legacySeed) {
    migrate(d, 19);
    d.exec(legacySeed);
  }
  migrate(d);
  globalForDb.__eqDb = d;
  return d;
}

export function getSetting(key: string): string | undefined {
  const row = db().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
