import crypto from "crypto";
import { getSetting, setSetting } from "./db";

// Private links that work without signing in (for example from an email, or
// when iPhone opens a link outside the installed app). Each token is an HMAC
// of what it's for, made with a secret kept in the database.

function secret() {
  let s = getSetting("link_secret");
  if (!s) {
    s = crypto.randomBytes(32).toString("base64url");
    setSetting("link_secret", s);
  }
  return s;
}

export function signToken(purpose: string) {
  return crypto.createHmac("sha256", secret()).update(purpose).digest("base64url").slice(0, 32);
}

export function validToken(purpose: string, token: string) {
  const a = Buffer.from(signToken(purpose));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
