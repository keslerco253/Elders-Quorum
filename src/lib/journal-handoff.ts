import crypto from "crypto";

// Older versions of the phone app can't print or save a file, so the journal is
// handed to the phone's browser view (which can) by a private link. The browser
// isn't signed in, so the finished page or Word document is made first and kept in
// this server's memory (never on disk) under a random token for 5 minutes, and can be
// opened only a few times (the browser may ask twice; a download may retry).

const TTL_MS = 5 * 60 * 1000;
const MAX_OPENS = 3;

export interface HandoffFile {
  body: string | Buffer;
  type: string;
  /** Downloaded as this name (a Word document); a page is shown. */
  filename?: string;
}

type Held = HandoffFile & { until: number; opens: number };
const g = globalThis as { journalHandoffs?: Map<string, Held> };
const held = (g.journalHandoffs ??= new Map());

function sweep(now = Date.now()) {
  for (const [t, h] of held) if (h.until < now) held.delete(t);
}

export function holdJournalFile(f: HandoffFile): string {
  sweep();
  const token = crypto.randomBytes(32).toString("base64url");
  held.set(token, { ...f, until: Date.now() + TTL_MS, opens: 0 });
  return token;
}

export function heldJournalFile(token: string): HandoffFile | null {
  sweep();
  const h = held.get(token);
  if (!h) return null;
  if (++h.opens >= MAX_OPENS) held.delete(token);
  return h;
}
