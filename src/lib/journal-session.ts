import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { isHttps } from "./config";
import { hasJournalPasscode } from "./journal";

// An unlocked journal (one with a passcode). The member's key is kept only in this
// server's memory, under a random token in a cookie, and forgotten after 30 minutes
// without using the journal, on "Lock now", or when the server restarts. It's never
// written to disk.

const COOKIE = "eq_journal";
const IDLE_MS = 30 * 60 * 1000;

type Open = { memberId: number; key: Buffer; until: number };
// On globalThis, so pages, actions and routes share it.
const g = globalThis as { journalOpen?: Map<string, Open> };
const open = (g.journalOpen ??= new Map());

function sweep(now = Date.now()) {
  for (const [t, o] of open) if (o.until < now) open.delete(t);
}

/**
 * Whether the member can see their journal now: `{ mk }` (their key when it has a
 * passcode, else null), or null when it's locked.
 */
export async function journalAccess(memberId: number): Promise<{ mk: Buffer | null } | null> {
  if (!hasJournalPasscode(memberId)) return { mk: null };
  sweep();
  const token = (await cookies()).get(COOKIE)?.value;
  const o = token ? open.get(token) : undefined;
  if (!o || o.memberId !== memberId) return null;
  o.until = Date.now() + IDLE_MS;
  return { mk: o.key };
}

/** Keeps the journal open (call only from a server action or route). */
export async function startJournalSession(memberId: number, key: Buffer) {
  sweep();
  const jar = await cookies();
  const old = jar.get(COOKIE)?.value;
  if (old) open.delete(old);
  const token = crypto.randomBytes(32).toString("base64url");
  open.set(token, { memberId, key, until: Date.now() + IDLE_MS });
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isHttps(), path: "/" });
}

/** Locks it again. */
export async function endJournalSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) open.delete(token);
  jar.delete(COOKIE);
}

/** Locks every session of this member's journal (passcode turned off or changed, journal erased). */
export function endAllJournalSessions(memberId: number) {
  for (const [t, o] of open) if (o.memberId === memberId) open.delete(t);
}
