import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { appUrl } from "./config";
import { DATA_DIR, db, replaceDatabase, setSetting } from "./db";
import { packTar, unpackTar } from "./tar";

const UPLOAD_NAME = /^[a-f0-9]{24}\.pdf$/;

interface BackupInfo {
  app: "elders-quorum";
  app_url: string;
  created_at: string;
}

/**
 * Everything the app keeps, in one file: the database plus uploaded PDFs.
 * Used to move the app to another server (restore it on the new server's
 * first-time setup page).
 */
export async function makeBackup(): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `eq-backup-${process.pid}-${Date.now()}.db`);
  try {
    await db().backup(tmp);
    const info: BackupInfo = { app: "elders-quorum", app_url: appUrl(), created_at: new Date().toISOString() };
    const entries = [
      { name: "backup-info.json", data: Buffer.from(JSON.stringify(info, null, 2)) },
      { name: "app.db", data: fs.readFileSync(tmp) },
    ];
    const uploads = path.join(DATA_DIR, "uploads");
    if (fs.existsSync(uploads)) {
      for (const f of fs.readdirSync(uploads).filter((f) => UPLOAD_NAME.test(f))) entries.push({ name: `uploads/${f}`, data: fs.readFileSync(path.join(uploads, f)) });
    }
    return packTar(entries);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export type RestoreResult = { ok: true; wards: number; members: number; files: number } | { ok: false; error: string };

/**
 * Replaces this server's data with a backup. Accepts the download from
 * makeBackup, or a single nightly app-YYYY-MM-DD.db file.
 */
export function restoreBackup(file: Buffer): RestoreResult {
  let dbData: Buffer | undefined;
  let info: Partial<BackupInfo> = {};
  let uploads: { name: string; data: Buffer }[] = [];
  if (isSqlite(file)) dbData = file;
  else {
    try {
      const entries = unpackTar(file);
      dbData = entries.find((e) => e.name === "app.db")?.data;
      const i = entries.find((e) => e.name === "backup-info.json");
      if (i) info = JSON.parse(i.data.toString("utf8"));
      uploads = entries.filter((e) => e.name.startsWith("uploads/")).map((e) => ({ name: e.name.slice(8), data: e.data })).filter((e) => UPLOAD_NAME.test(e.name));
    } catch {
      return { ok: false, error: "That file isn't a backup from this app." };
    }
  }
  if (!dbData || !isSqlite(dbData)) return { ok: false, error: "That file isn't a backup from this app." };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const incoming = path.join(DATA_DIR, "app.db.incoming");
  fs.writeFileSync(incoming, dbData);
  let counts: { wards: number; members: number };
  try {
    const check = new Database(incoming, { readonly: true });
    try {
      const ok = (check.pragma("quick_check", { simple: true }) as string) === "ok";
      const tables = new Set((check.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name));
      if (!ok || !tables.has("wards") || !tables.has("members")) throw new Error("not ours");
      counts = {
        wards: (check.prepare("SELECT COUNT(*) AS n FROM wards").get() as { n: number }).n,
        members: (check.prepare("SELECT COUNT(*) AS n FROM members").get() as { n: number }).n,
      };
    } finally {
      check.close();
    }
  } catch {
    fs.rmSync(incoming, { force: true });
    return { ok: false, error: "That file isn't a backup from this app, or it's damaged." };
  }

  replaceDatabase(incoming);
  const dir = path.join(DATA_DIR, "uploads");
  if (uploads.length) fs.mkdirSync(dir, { recursive: true });
  for (const u of uploads) fs.writeFileSync(path.join(dir, u.name), u.data);
  // Moved to a new address: phones signed up for notifications on the old one
  // are replaced as each member turns notifications on here.
  if (info.app_url && info.app_url !== appUrl()) setSetting("moved_at", new Date().toISOString().replace("T", " ").slice(0, 19));
  return { ok: true, ...counts, files: uploads.length };
}

function isSqlite(b: Buffer) {
  return b.subarray(0, 16).toString("latin1") === "SQLite format 3\0";
}
