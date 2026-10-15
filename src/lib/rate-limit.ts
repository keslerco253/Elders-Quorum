import { db } from "./db";

/**
 * Counts one attempt under `key` and says whether it's allowed: no more than
 * `limit` in the last `minutes`. Old attempts are cleared as it goes.
 */
export function allowHit(key: string, limit: number, minutes: number): boolean {
  const d = db();
  d.prepare("DELETE FROM rate_hits WHERE created_at < datetime('now', '-1 day')").run();
  const n = (d.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND created_at > datetime('now', ?)").get(key, `-${minutes} minutes`) as { n: number }).n;
  if (n >= limit) return false;
  d.prepare("INSERT INTO rate_hits (key) VALUES (?)").run(key);
  return true;
}

/** Whether `key` is already over its limit (without counting a new attempt). */
export function overLimit(key: string, limit: number, minutes: number): boolean {
  return (db().prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND created_at > datetime('now', ?)").get(key, `-${minutes} minutes`) as { n: number }).n >= limit;
}

/**
 * The visitor's address. The hosting's proxy adds it to the end of X-Forwarded-For
 * (anything earlier could be typed by the visitor). Behind Cloudflare, set
 * CLIENT_IP_HEADER=cf-connecting-ip.
 */
export function clientIp(headers: Headers): string {
  const named = process.env.CLIENT_IP_HEADER?.trim();
  if (named) return headers.get(named)?.trim() || "unknown";
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}
