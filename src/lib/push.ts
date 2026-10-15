import webpush from "web-push";
import { appUrl } from "./config";
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
  /**
   * A personal note from one leader: the text and email carry just the words,
   * signed with their name, without the ward header or a link.
   */
  personal?: { from: string };
  /** A member's message to leaders: the text carries all of it (not cut short), then the link to answer. */
  fullText?: boolean;
  /** A leader texted this can answer the member by replying to the text. */
  replyTo?: { memberId: number; private: boolean };
  /** A line under an email's text (e.g. that replies go in the app, not by email). */
  emailNote?: string;
  /** Notifications with the same tag replace each other (one per conversation). */
  tag?: string;
  /** Shorter heading for a fullText text, e.g. "Hyrum Johnson (private)". */
  textTitle?: string;
}

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends to every device the member registered (browsers and the phone app). Returns how many deliveries succeeded. */
export async function pushToMember(memberId: number, payload: PushPayload): Promise<number> {
  const subs = db().prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ?").all(memberId) as SubRow[];
  let ok = await pushToApp(memberId, payload);
  if (!subs.length) return ok;
  ensureVapid();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(withFullLinks(payload)), { TTL: 60 * 60 * 24 });
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

/**
 * Full addresses, so a phone still signed up on an old address (after a move
 * to a new server) opens the app where it is now.
 */
export function withFullLinks(payload: PushPayload): PushPayload {
  const full = (u: string) => (u.startsWith("/") ? appUrl() + u : u);
  return { ...payload, url: full(payload.url ?? "/"), actions: payload.actions?.map((a) => ({ ...a, url: full(a.url) })) };
}

// ----- The phone app (Expo push service, which delivers through Apple and Google) -----

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const isExpoToken = (t: unknown): t is string => typeof t === "string" && /^Expo(nent)?PushToken\[[^\]]{10,200}\]$/.test(t);

/** Remembers a phone's app token for the signed-in member (a phone belongs to whoever signed in last). */
export function saveAppToken(memberId: number, token: string, platform: string) {
  db()
    .prepare(
      `INSERT INTO native_push_tokens (token, member_id, platform) VALUES (?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET member_id = excluded.member_id, platform = excluded.platform, updated_at = datetime('now')`,
    )
    .run(token, memberId, platform.slice(0, 20));
}

export function removeAppToken(token: string, memberId?: number) {
  db()
    .prepare(`DELETE FROM native_push_tokens WHERE token = ? ${memberId ? "AND member_id = ?" : ""}`)
    .run(...(memberId ? [token, memberId] : [token]));
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/** Sends to the member's phones that have the app. Returns how many were accepted. */
async function pushToApp(memberId: number, payload: PushPayload): Promise<number> {
  const tokens = (db().prepare("SELECT token FROM native_push_tokens WHERE member_id = ?").all(memberId) as { token: string }[]).map((r) => r.token);
  if (!tokens.length) return 0;
  const p = withFullLinks(payload);
  const messages = tokens.map((to) => ({ to, title: p.title, body: p.body, data: { url: p.url }, sound: "default", priority: "high", channelId: "default" }));
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        // Optional: required only if "enhanced push security" is turned on in Expo.
        ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[]; errors?: { message: string }[] };
    if (!res.ok || !Array.isArray(json.data)) {
      console.error("[push] app send failed", res.status, json.errors?.[0]?.message);
      return 0;
    }
    let ok = 0;
    json.data.forEach((t, i) => {
      if (t.status === "ok") ok++;
      // The app was removed or notifications were turned off on that phone.
      else if (t.details?.error === "DeviceNotRegistered") removeAppToken(tokens[i]);
      else console.error("[push] app ticket error", t.details?.error, t.message);
    });
    return ok;
  } catch (err) {
    console.error("[push] app send failed", (err as Error).message);
    return 0;
  }
}

export function savePushSubscription(memberId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  // After the app moved to a new address, a member turning notifications on
  // here replaces the devices they signed up on the old address.
  const movedAt = getSetting("moved_at");
  if (movedAt) db().prepare("DELETE FROM push_subscriptions WHERE member_id = ? AND created_at < ? AND endpoint <> ?").run(memberId, movedAt, sub.endpoint);
  db()
    .prepare(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    )
    .run(memberId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}
