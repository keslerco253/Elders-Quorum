import crypto from "crypto";
import { getSetting, setSetting } from "./db";

/**
 * Seals small secrets kept in the database (an organization's email app password).
 * The key is MAIL_KEY from the server's settings when set (so it isn't in the database
 * or its backups), else one kept in the database.
 */
function key(): Buffer {
  const env = process.env.MAIL_KEY?.trim();
  if (env) return crypto.createHash("sha256").update(env).digest();
  let stored = getSetting("secret_box_key");
  if (!stored) {
    stored = crypto.randomBytes(32).toString("base64");
    setSetting("secret_box_key", stored);
  }
  return Buffer.from(stored, "base64");
}

export function sealSecret(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const out = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), out]).toString("base64");
}

/** Null when it can't be opened (the key changed): it has to be entered again. */
export function openSecret(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64");
    const d = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      raw.subarray(0, 12),
    );
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
