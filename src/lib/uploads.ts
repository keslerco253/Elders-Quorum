import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, db } from "./db";
import { sniffDocument, sniffUpload, UPLOAD_NAME, UPLOAD_TYPES } from "./upload-names";

const dir = () => path.join(DATA_DIR, "uploads");

/** Saves an attached PDF or picture and returns its stored file name. Throws for any other kind of file. */
export async function saveUpload(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffUpload(buf);
  if (!ext) throw new Error("unsupported file");
  fs.mkdirSync(dir(), { recursive: true });
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir(), name), buf);
  return name;
}

/** Saves an attached document (PDF, picture, Office file or plain text). Throws for anything else. */
export async function saveDocument(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffDocument(buf, file.name);
  if (!ext) throw new Error("unsupported file");
  fs.mkdirSync(dir(), { recursive: true });
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir(), name), buf);
  return name;
}

/** Removes a stored file (when what it was attached to lets it go). */
export function deleteUpload(name: string) {
  if (!UPLOAD_NAME.test(name)) return;
  try {
    fs.unlinkSync(path.join(dir(), name));
  } catch {
    // Already gone.
  }
}

export function readUpload(name: string): { data: Buffer; type: string } | null {
  if (!UPLOAD_NAME.test(name)) return null;
  const p = path.join(dir(), name);
  if (!fs.existsSync(p)) return null;
  return { data: fs.readFileSync(p), type: UPLOAD_TYPES[name.split(".").pop() as keyof typeof UPLOAD_TYPES] };
}

/**
 * Deletes kept pictures of members' own events and to-dos that nothing uses any more
 * (several events made from one texted picture share it).
 */
export function deletePicturesIfUnused(names: string[]) {
  const d = db();
  for (const name of names) {
    const like = `%"${name}"%`;
    const used = d.prepare("SELECT 1 FROM personal_events WHERE images LIKE ? UNION ALL SELECT 1 FROM personal_todos WHERE images LIKE ? LIMIT 1").get(like, like);
    if (!used) deleteUpload(name);
  }
}
