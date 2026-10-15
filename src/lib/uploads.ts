import "server-only";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./db";
import { sniffUpload, UPLOAD_NAME, UPLOAD_TYPES } from "./upload-names";

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

export function readUpload(name: string): { data: Buffer; type: string } | null {
  if (!UPLOAD_NAME.test(name)) return null;
  const p = path.join(dir(), name);
  if (!fs.existsSync(p)) return null;
  return { data: fs.readFileSync(p), type: UPLOAD_TYPES[name.split(".").pop() as keyof typeof UPLOAD_TYPES] };
}
