// Login tokens and sessions, independent of Next.js so they can be unit tested.
import crypto from "crypto";
import { DateTime } from "luxon";
import { db } from "./db";
import type { CurrentUser, Member } from "./types";
import { currentUserFor, getOrg, inWard } from "./orgs";
import { parseContact } from "./contact";

export const REMEMBER_OPTIONS = {
  session: { label: "Just this time (until I close the browser)", days: 1 },
  day: { label: "1 day", days: 1 },
  month: { label: "30 days", days: 30 },
  year: { label: "1 year", days: 365 },
} as const;
export type Remember = keyof typeof REMEMBER_OPTIONS;
export const isRemember = (v: unknown): v is Remember => typeof v === "string" && v in REMEMBER_OPTIONS;

const TOKEN_MINUTES = 20;
const MAX_CODE_ATTEMPTS = 5;
const MAX_TOKENS_PER_HOUR = 5;
const MAX_WRONG_CODES_PER_DAY = 15;

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const nowIso = () => DateTime.utc().toISO()!;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** The active member who signs in with this phone number or email, if any. */
export function findLoginMember(contact: string): Member | undefined {
  const c = parseContact(contact);
  if (!c) return undefined;
  const col = c.kind === "phone" ? "phone" : "lower(email)";
  return db()
    .prepare(`SELECT * FROM members WHERE ${col} = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1`)
    .get(c.value) as Member | undefined;
}

/** The account (any status) with this phone number or email, newest first. */
export function findMemberByContact(contact: string): Member | undefined {
  const c = parseContact(contact);
  if (!c) return undefined;
  const col = c.kind === "phone" ? "phone" : "lower(email)";
  return db().prepare(`SELECT * FROM members WHERE ${col} = ? ORDER BY updated_at DESC LIMIT 1`).get(c.value) as Member | undefined;
}

export type CreateTokenResult = { ok: true; token: string; code: string } | { ok: false; reason: "rate_limited" };

export function createLoginToken(memberId: number, remember: Remember): CreateTokenResult {
  const d = db();
  const recent = d
    .prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE member_id = ? AND created_at > datetime('now', '-1 hour')")
    .get(memberId) as { n: number };
  if (recent.n >= MAX_TOKENS_PER_HOUR) return { ok: false, reason: "rate_limited" };
  const token = crypto.randomBytes(32).toString("base64url");
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  d.prepare("INSERT INTO login_tokens (member_id, token_hash, code_hash, remember, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    memberId,
    sha256(token),
    sha256(`${memberId}:${code}`),
    remember,
    DateTime.utc().plus({ minutes: TOKEN_MINUTES }).toISO(),
  );
  return { ok: true, token, code };
}

interface TokenRow {
  id: number;
  member_id: number;
  remember: Remember;
  attempts: number;
  expires_at: string;
  used_at: string | null;
}

function consume(row: TokenRow | undefined): { memberId: number; remember: Remember } | null {
  if (!row || row.used_at || row.expires_at < nowIso()) return null;
  db().prepare("UPDATE login_tokens SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
  return { memberId: row.member_id, remember: row.remember };
}

export function redeemToken(token: string) {
  const row = db().prepare("SELECT * FROM login_tokens WHERE token_hash = ?").get(sha256(token)) as TokenRow | undefined;
  return consume(row);
}

/** Redeem the 6-digit code sent by email or text. */
export function redeemCode(contact: string, code: string) {
  const member = findLoginMember(contact);
  if (!member) return null;
  const d = db();
  const row = d
    .prepare("SELECT * FROM login_tokens WHERE member_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY id DESC LIMIT 1")
    .get(member.id, nowIso()) as TokenRow | undefined;
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return null;
  // Across all their codes: no more than this many wrong tries a day, so a code can't be guessed.
  const wrongToday = (d.prepare("SELECT COALESCE(SUM(attempts), 0) AS n FROM login_tokens WHERE member_id = ? AND created_at > datetime('now', '-1 day')").get(member.id) as { n: number }).n;
  if (wrongToday >= MAX_WRONG_CODES_PER_DAY) return null;
  const expected = d.prepare("SELECT code_hash FROM login_tokens WHERE id = ?").get(row.id) as { code_hash: string };
  if (expected.code_hash !== sha256(`${member.id}:${code.replace(/\D/g, "")}`)) {
    d.prepare("UPDATE login_tokens SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return null;
  }
  return consume(row);
}

/** Creates a session and returns the raw id to put in the cookie. */
export function createSession(memberId: number, remember: Remember, userAgent?: string | null) {
  const id = crypto.randomBytes(32).toString("base64url");
  const expires = DateTime.utc().plus({ days: REMEMBER_OPTIONS[remember].days });
  const d = db();
  d.prepare("INSERT INTO sessions (id, member_id, expires_at, user_agent) VALUES (?, ?, ?, ?)").run(sha256(id), memberId, expires.toISO(), userAgent?.slice(0, 300) ?? null);
  d.prepare("UPDATE members SET last_login_at = ? WHERE id = ?").run(nowIso(), memberId);
  d.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  d.prepare("DELETE FROM login_tokens WHERE expires_at < datetime('now', '-1 day')").run();
  return { id, expires: expires.toJSDate() };
}

/**
 * The signed-in member, seen from the organization they last switched to on
 * any device: this device's choice (wanted) if it's newer than the one saved
 * on their account, which it then replaces. Otherwise a sensible default.
 */
export function userForSession(sessionId: string | undefined, wanted?: { orgId: number; at: number }): CurrentUser | null {
  if (!sessionId) return null;
  const d = db();
  const member = d
    .prepare(
      `SELECT m.* FROM sessions s JOIN members m ON m.id = s.member_id
       WHERE s.id = ? AND s.expires_at > ? AND m.status = 'active'`,
    )
    .get(sha256(sessionId), nowIso()) as Member | undefined;
  if (!member) return null;
  let orgId = member.last_org_id ?? undefined;
  const wantedOrg = wanted && getOrg(wanted.orgId);
  if (wanted && wantedOrg && inWard(member.id, wantedOrg.ward_id) && wanted.at > member.last_org_at && wanted.orgId !== member.last_org_id) {
    d.prepare("UPDATE members SET last_org_id = ?, last_org_at = ? WHERE id = ?").run(wanted.orgId, wanted.at, member.id);
    orgId = wanted.orgId;
  } else if (!orgId) orgId = wanted?.orgId;
  return currentUserFor(member, orgId);
}

export function deleteSession(sessionId: string) {
  db().prepare("DELETE FROM sessions WHERE id = ?").run(sha256(sessionId));
}
