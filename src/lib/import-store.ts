import "server-only";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db, DATA_DIR } from "./db";
import { guessMapping, parseCsv, planImport, toRows, type ExistingMember, type Mapping } from "./lcr-import";

// Uploaded CSVs wait here between "preview" and "apply" (never in a public folder).
const dir = () => path.join(DATA_DIR, "imports");
const fileFor = (id: string) => path.join(dir(), `${id.replace(/[^a-f0-9]/g, "")}.csv`);

export function saveUpload(data: Buffer) {
  fs.mkdirSync(dir(), { recursive: true });
  // Clear out abandoned uploads older than a day.
  for (const f of fs.readdirSync(dir())) {
    const p = path.join(dir(), f);
    if (Date.now() - fs.statSync(p).mtimeMs > 86_400_000) fs.rmSync(p, { force: true });
  }
  const id = crypto.randomBytes(12).toString("hex");
  fs.writeFileSync(fileFor(id), data);
  return id;
}

export function deleteUpload(id: string) {
  fs.rmSync(fileFor(id), { force: true });
}

export function loadImport(wardId: number, fileId: string, mapping?: Partial<Mapping>) {
  const p = fileFor(fileId);
  if (!fileId || !fs.existsSync(p)) return null;
  const { headers, rows } = parseCsv(fs.readFileSync(p, "utf8"));
  const m: Mapping = { ...guessMapping(headers) };
  for (const k of Object.keys(m) as (keyof Mapping)[]) if (mapping?.[k] !== undefined) m[k] = mapping[k]!;
  const { rows: parsed, skipped } = toRows(rows, m);
  const existing = db()
    .prepare("SELECT id, name, email, phone, address, status, source, role FROM members WHERE ward_id = ? AND status != 'declined'")
    .all(wardId) as ExistingMember[];
  return { headers, mapping: m, plan: planImport(parsed, existing, skipped) };
}
