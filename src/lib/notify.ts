import { db } from "./db";
import { appUrl } from "./config";
import { emailHtml, sendMail } from "./mail";
import { pushToMember, type PushPayload } from "./push";
import { DateTime } from "luxon";

export type Audience = "everyone" | "admins" | "presidency" | "teachers" | `group:${number}`;

export interface Recipient {
  id: number;
  email: string | null;
  display_name: string;
}

const BASE = "SELECT id, email, display_name FROM members WHERE ward_id = ? AND status = 'active'";

/** Active members (everyone who joined and was approved) in an audience. */
export function audienceMembers(wardId: number, audience: Audience, opts: { tz?: string } = {}): Recipient[] {
  const d = db();
  if (audience === "everyone") return d.prepare(BASE).all(wardId) as Recipient[];
  if (audience === "admins") return d.prepare(BASE + " AND role IN ('admin','presidency')").all(wardId) as Recipient[];
  if (audience === "presidency") return d.prepare(BASE + " AND role = 'presidency'").all(wardId) as Recipient[];
  if (audience === "teachers") {
    const today = DateTime.now().setZone(opts.tz || "America/Boise").toISODate()!;
    const until = DateTime.fromISO(today).plus({ weeks: 5 }).toISODate()!;
    return d
      .prepare(BASE + " AND id IN (SELECT teacher_id FROM lessons WHERE ward_id = ? AND date BETWEEN ? AND ? AND teacher_id IS NOT NULL)")
      .all(wardId, wardId, today, until) as Recipient[];
  }
  if (audience.startsWith("group:")) {
    const groupId = Number(audience.slice(6));
    return d
      .prepare(BASE + " AND id IN (SELECT member_id FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE g.id = ? AND g.ward_id = ?)")
      .all(wardId, groupId, wardId) as Recipient[];
  }
  return [];
}

export function audienceLabel(wardId: number, audience: Audience): string {
  switch (audience) {
    case "everyone":
      return "Everyone";
    case "admins":
      return "Admins (presidency, bishop, high councilor)";
    case "presidency":
      return "Presidency";
    case "teachers":
      return "Upcoming teachers";
  }
  const g = db().prepare("SELECT name FROM groups WHERE id = ? AND ward_id = ?").get(Number(audience.slice(6)), wardId) as { name: string } | undefined;
  return g ? `Group: ${g.name}` : "Group";
}

/**
 * Push to each recipient's devices; recipients with no working push
 * subscription get an email instead (when they have an address).
 */
export async function notify(recipients: Recipient[], payload: PushPayload, opts: { email?: boolean } = {}) {
  const emailFallback = opts.email ?? true;
  let push = 0;
  let email = 0;
  const url = payload.url ? appUrl() + payload.url : appUrl();
  for (const r of recipients) {
    const delivered = await pushToMember(r.id, payload);
    if (delivered > 0) {
      push++;
      continue;
    }
    if (emailFallback && r.email) {
      const ok = await sendMail({
        to: r.email,
        subject: payload.title,
        text: `${payload.body}\n\n${url}`,
        html: emailHtml(payload.title, payload.body, { url, label: "Open the app" }),
      });
      if (ok) email++;
    }
  }
  return { push, email };
}

/** Records a dedupe key. Returns false if this notification was already sent. */
export function claimOnce(key: string): boolean {
  const res = db().prepare("INSERT OR IGNORE INTO sent_notifications (key) VALUES (?)").run(key);
  return res.changes > 0;
}
