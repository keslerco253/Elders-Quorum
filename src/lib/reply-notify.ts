import { db } from "./db";
import { conductorOn } from "./conducting";
import type { Recipient } from "./notify";

// Who hears about a member's message, so the whole presidency isn't texted every time.
// It goes to the person who sent what the member is answering (a message's sender, an
// event's maker, that Sunday's conductor...), else the presidency's message lead, else
// the president. Each leader chooses: just ones for them (the default), every one, or
// none. Everyone still sees it in Messages.

export type MsgNotify = "mine" | "all" | "none";
export const MSG_NOTIFY: MsgNotify[] = ["mine", "all", "none"];

/** A leader's choice of which member messages they're notified about. */
export function msgNotify(orgId: number, leaderId: number): MsgNotify {
  const v = (db().prepare("SELECT msg_notify FROM org_members WHERE org_id = ? AND member_id = ?").get(orgId, leaderId) as { msg_notify: string } | undefined)?.msg_notify;
  return MSG_NOTIFY.includes(v as MsgNotify) ? (v as MsgNotify) : "mine";
}

/** The presidency's message lead: the one chosen, else the president (or bishop). */
export function messageLead(orgId: number): number | null {
  const d = db();
  const chosen = (d.prepare("SELECT message_lead_id FROM orgs WHERE id = ?").get(orgId) as { message_lead_id: number | null } | undefined)?.message_lead_id;
  if (chosen && d.prepare("SELECT 1 FROM org_members WHERE org_id = ? AND member_id = ? AND role = 'presidency'").get(orgId, chosen)) return chosen;
  const head = d.prepare("SELECT member_id FROM org_members WHERE org_id = ? AND role = 'presidency' AND calling IN ('president','bishop') ORDER BY calling = 'bishop' DESC LIMIT 1").get(orgId) as
    | { member_id: number }
    | undefined;
  return head?.member_id ?? null;
}

/**
 * Who sent what the member is most likely answering: the message they replied to, or the
 * newest thing the organization sent them this past week (a message, an event, a lesson,
 * a sign-up, an assignment, a visit invitation).
 */
export function pointPerson(orgId: number, memberId: number, messageId: number | null): number | null {
  const d = db();
  if (messageId) {
    const s = d.prepare("SELECT sender_id FROM messages WHERE id = ?").get(messageId) as { sender_id: number | null } | undefined;
    if (s?.sender_id) return s.sender_id;
  }
  const last = d
    .prepare("SELECT url FROM notification_log WHERE member_id = ? AND org_id = ? AND created_at > datetime('now', '-7 days') ORDER BY id DESC LIMIT 1")
    .get(memberId, orgId) as { url: string } | undefined;
  const path = last?.url.split(/[?#]/)[0] ?? "";
  const id = (re: RegExp) => Number(path.match(re)?.[1] ?? 0);
  const one = (sql: string, v: number) => (v ? ((d.prepare(sql).get(v) as { who: number | null } | undefined)?.who ?? null) : null);
  if (id(/^\/messages\/a\/(\d+)/)) return one("SELECT sender_id AS who FROM messages WHERE id = ?", id(/^\/messages\/a\/(\d+)/));
  if (id(/^\/calendar\/(\d+)/)) return one("SELECT created_by AS who FROM events WHERE id = ?", id(/^\/calendar\/(\d+)/));
  if (id(/^\/signups\/(\d+)/)) return one("SELECT created_by AS who FROM signups WHERE id = ?", id(/^\/signups\/(\d+)/));
  if (id(/^\/assignments\/(\d+)/)) return one("SELECT created_by AS who FROM todos WHERE id = ?", id(/^\/assignments\/(\d+)/));
  if (id(/^\/visit-invite\/(\d+)/)) return one("SELECT created_by AS who FROM planned_visits WHERE id = ?", id(/^\/visit-invite\/(\d+)/));
  if (id(/^\/lessons\/(\d+)/)) {
    const lesson = d.prepare("SELECT date FROM lessons WHERE id = ?").get(id(/^\/lessons\/(\d+)/)) as { date: string } | undefined;
    return lesson ? conductorOn(orgId, lesson.date) : null;
  }
  return null;
}

/**
 * Of the leaders who take messages, the ones to notify about this member's message:
 * those who want every one, and the one it's for (the sender of what they answered,
 * else the message lead, else the first) if they want theirs.
 */
export function whoToNotify(orgId: number, memberId: number, messageId: number | null, receivers: Recipient[]): Recipient[] {
  if (!receivers.length) return [];
  const ids = new Set(receivers.map((r) => r.id));
  const point = [pointPerson(orgId, memberId, messageId), messageLead(orgId)].find((id): id is number => !!id && ids.has(id)) ?? receivers[0].id;
  return receivers.filter((r) => {
    const pref = msgNotify(orgId, r.id);
    return pref === "all" || (pref === "mine" && r.id === point);
  });
}

/** A conversation someone said "I've got it" for (whole-presidency thread). */
export function claimOf(orgId: number, memberId: number): { claimed_by: number; name: string; claimed_at: string } | undefined {
  return db()
    .prepare("SELECT c.claimed_by, m.display_name AS name, c.claimed_at FROM conversation_claims c JOIN members m ON m.id = c.claimed_by WHERE c.org_id = ? AND c.member_id = ?")
    .get(orgId, memberId) as { claimed_by: number; name: string; claimed_at: string } | undefined;
}

export function claimConversation(orgId: number, memberId: number, leaderId: number) {
  db().prepare("INSERT INTO conversation_claims (org_id, member_id, claimed_by) VALUES (?, ?, ?) ON CONFLICT(org_id, member_id) DO UPDATE SET claimed_by = excluded.claimed_by, claimed_at = datetime('now')").run(orgId, memberId, leaderId);
}

export function releaseConversation(orgId: number, memberId: number) {
  db().prepare("DELETE FROM conversation_claims WHERE org_id = ? AND member_id = ?").run(orgId, memberId);
}
