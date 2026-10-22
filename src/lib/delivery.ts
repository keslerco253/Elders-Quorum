import { db } from "./db";
import { canSendNotice } from "./sms";
import { fallbackChannels, type ContactPref } from "./contact";

// Whether what we sent actually reached people. A notification goes by app
// notification when they have it on, otherwise by email or text; someone with
// none of those can't be reached at all, and leaders need to know so they can
// tell them another way.

export type Way = "push" | "email" | "text";
export const WAY_LABELS: Record<Way, string> = { push: "app notification", email: "email", text: "text" };

/** "app notification and email", or "" for none. */
export function waysText(delivered: string | null): string {
  const ways = (delivered ?? "").split(",").filter(Boolean) as Way[];
  const labels = ways.map((w) => WAY_LABELS[w] ?? w);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : (labels[0] ?? "");
}

/**
 * The ways the app could reach this person now, as their own settings allow: app
 * notifications on a device, and email or texts if they chose them (every time, or
 * when a notification doesn't reach them). Someone who turned all of that off can't
 * be reached.
 */
export function reachableBy(memberId: number, orgId: number): Way[] {
  const m = db().prepare("SELECT email, phone, sms_consent_at, contact_pref, always_email, always_text FROM members WHERE id = ?").get(memberId) as
    | { email: string | null; phone: string | null; sms_consent_at: string | null; contact_pref: ContactPref; always_email: number; always_text: number }
    | undefined;
  if (!m) return [];
  const push =
    !!db().prepare("SELECT 1 FROM push_subscriptions WHERE member_id = ?").get(memberId) || !!db().prepare("SELECT 1 FROM native_push_tokens WHERE member_id = ?").get(memberId);
  const canText = !!m.phone && !!m.sms_consent_at && canSendNotice(orgId);
  const backup = fallbackChannels(m, canText);
  const ways: Way[] = [];
  if (push) ways.push("push");
  if (m.email && (m.always_email || backup.includes("email"))) ways.push("email");
  if (canText && (m.always_text || backup.includes("text"))) ways.push("text");
  return ways;
}

/** Why someone can't be reached, in a few words (for leaders). */
export function unreachableWhy(memberId: number): string {
  const m = db().prepare("SELECT email, phone, contact_pref FROM members WHERE id = ?").get(memberId) as { email: string | null; phone: string | null; contact_pref: string } | undefined;
  if (!m) return "";
  if (m.contact_pref === "none") return "they turned off email and text backups, and don't have app notifications on";
  if (!m.email && !m.phone) return "no app notifications, and no email or phone number on file";
  return "no app notifications, and email or texts aren't available for them";
}

/**
 * Members of an organization who turned off its notifications (More → My organizations),
 * so messages to everyone in it don't go to them.
 */
export function optedOutOf(orgId: number): string[] {
  return (
    db()
      .prepare(
        `SELECT m.display_name AS name FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
         WHERE m.status = 'active' AND om.notify = 0 AND om.role = 'member' AND om.official = 1 ORDER BY m.display_name COLLATE NOCASE`,
      )
      .all(orgId) as { name: string }[]
  ).map((r) => r.name);
}

/** Notifications whose link is this page (e.g. /assignments/30), not /assignments/300. */
const forPage = "(url = ? OR url LIKE ? || '?%' OR url LIKE ? || '#%')";

export interface Delivery {
  /** '' when it couldn't reach them; null for notifications from before this was kept. */
  delivered: string | null;
  sent_at: string;
  read_at: string | null;
}

/** The latest notification this person got about a page, if any. */
export function lastDelivery(memberId: number, page: string): Delivery | undefined {
  return db()
    .prepare(`SELECT delivered, created_at AS sent_at, read_at FROM notification_log WHERE member_id = ? AND ${forPage} ORDER BY id DESC LIMIT 1`)
    .get(memberId, page, page, page) as Delivery | undefined;
}

export interface MessageReach {
  total: number;
  seen: number;
  /** Messages to everyone: members who turned off this organization's notifications (they weren't sent it). */
  optedOut: string[];
  /** Nothing reached them (no app notifications, email or texts). */
  unreached: string[];
  /** Reached, but they haven't opened it yet. */
  unseen: string[];
}

/** Who a message to a group reached, and who has opened it. */
export function messageReach(messageId: number): MessageReach {
  const page = `/messages/a/${messageId}`;
  const rows = db()
    .prepare(
      `SELECT m.display_name AS name, r.read_at,
         (SELECT n.delivered FROM notification_log n WHERE n.member_id = r.member_id AND ${forPage.replace(/url/g, "n.url")} ORDER BY n.id DESC LIMIT 1) AS delivered
       FROM message_recipients r JOIN members m ON m.id = r.member_id WHERE r.message_id = ? ORDER BY m.display_name COLLATE NOCASE`,
    )
    .all(page, page, page, messageId) as { name: string; read_at: string | null; delivered: string | null }[];
  const msg = db().prepare("SELECT org_id, audience FROM messages WHERE id = ?").get(messageId) as { org_id: number; audience: string } | undefined;
  return {
    total: rows.length,
    seen: rows.filter((r) => r.read_at).length,
    optedOut: msg?.audience === "everyone" ? optedOutOf(msg.org_id) : [],
    unreached: rows.filter((r) => !r.read_at && r.delivered === "").map((r) => r.name),
    unseen: rows.filter((r) => !r.read_at && r.delivered !== "").map((r) => r.name),
  };
}
