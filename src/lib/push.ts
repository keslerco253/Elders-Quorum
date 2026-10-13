import webpush from "web-push";
import { db, getSetting, setSetting } from "./db";

let configured = false;

export function vapidPublicKey(): string {
  ensureVapid();
  return getSetting("vapid_public")!;
}

function ensureVapid() {
  if (configured) return;
  let pub = getSetting("vapid_public");
  let priv = getSetting("vapid_private");
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    setSetting("vapid_public", pub);
    setSetting("vapid_private", priv);
  }
  const contact = process.env.SMTP_USER || "admin@example.com";
  webpush.setVapidDetails(`mailto:${contact}`, pub, priv);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Buttons on the notification (Android and computers; iPhones show none). */
  actions?: { action: string; title: string; url: string }[];
  /** Label for the email's button (default "Open the app"). */
  linkLabel?: string;
  /** Replaces body in a text message, e.g. to add "Reply TEACH…". */
  textBody?: string;
}

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends to every device the member registered. Returns how many deliveries succeeded. */
export async function pushToMember(memberId: number, payload: PushPayload): Promise<number> {
  const subs = db().prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ?").all(memberId) as SubRow[];
  if (!subs.length) return 0;
  ensureVapid();
  let ok = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
        ok++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) db().prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id);
        else console.error("[push] failed", code, (err as Error).message);
      }
    }),
  );
  return ok;
}

export function savePushSubscription(memberId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  db()
    .prepare(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    )
    .run(memberId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}
