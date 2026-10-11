import "server-only";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "./db";

const dir = () => path.join(DATA_DIR, "uploads");

/** Saves an uploaded PDF and returns its stored file name. */
export async function savePdf(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("not a pdf");
  fs.mkdirSync(dir(), { recursive: true });
  const name = `${crypto.randomBytes(12).toString("hex")}.pdf`;
  fs.writeFileSync(path.join(dir(), name), buf);
  return name;
}

export function readUpload(name: string): Buffer | null {
  if (!/^[a-f0-9]{24}\.pdf$/.test(name)) return null;
  const p = path.join(dir(), name);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}
