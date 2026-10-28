import "server-only";
import crypto from "crypto";

// Older versions of the phone app can't print or save a file, so the journal is
// handed to the phone's browser view (which can) by a private link. The browser
// isn't signed in, so the finished page or Word document is made first and kept in
// this server's memory (never on disk) under a random token for 10 minutes.

const TTL_MS = 10 * 60 * 1000;

export interface HandoffFile {
  body: string | Buffer;
  type: string;
  /** Downloaded as this name (a Word document); a page is shown. */
  filename?: string;
}

type Held = HandoffFile & { until: number };
const g = globalThis as { journalHandoffs?: Map<string, Held> };
const held = (g.journalHandoffs ??= new Map());

function sweep(now = Date.now()) {
  for (const [t, h] of held) if (h.until < now) held.delete(t);
}

export function holdJournalFile(f: HandoffFile): string {
  sweep();
  const token = crypto.randomBytes(32).toString("base64url");
  held.set(token, { ...f, until: Date.now() + TTL_MS });
  return token;
}

export function heldJournalFile(token: string): HandoffFile | null {
  sweep();
  return held.get(token) ?? null;
}
