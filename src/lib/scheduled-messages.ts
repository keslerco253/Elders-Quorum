import { DateTime } from "luxon";
import { db } from "./db";
import { ledOrgIds } from "./conversations";
import { sendToAudience } from "./groups";
import { audienceLabel, type Audience } from "./notify";
import { getOrg, getWard } from "./orgs";

// A message a leader wrote to send later (Messages → New message → Send later), with an
// optional reminder: the same message again at a second time. Sent by the scheduler.

export interface ScheduledMessage {
  id: number;
  org_id: number;
  sender_id: number;
  audience: Audience;
  title: string;
  body: string;
  link: string;
  flyer_file: string | null;
  flyer_name: string | null;
  /** UTC ISO times. */
  send_at: string;
  reminder_at: string | null;
  sent_at: string | null;
  sent_message_id: number | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export type ScheduleInput = Pick<ScheduledMessage, "org_id" | "sender_id" | "audience" | "title" | "body" | "link" | "flyer_file" | "flyer_name" | "send_at" | "reminder_at">;

export function scheduleMessage(s: ScheduleInput): number {
  return Number(
    db()
      .prepare("INSERT INTO scheduled_messages (org_id, sender_id, audience, title, body, link, flyer_file, flyer_name, send_at, reminder_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(s.org_id, s.sender_id, s.audience, s.title, s.body, s.link, s.flyer_file, s.flyer_name, s.send_at, s.reminder_at).lastInsertRowid,
  );
}

/** Still to go out (the message, or its reminder), in the organizations this leader leads, soonest first. */
export function pendingScheduled(viewerId: number): (ScheduledMessage & { sender_name: string; audience_label: string })[] {
  const orgs = ledOrgIds(viewerId);
  if (!orgs.length) return [];
  const rows = db()
    .prepare(
      `SELECT s.*, m.display_name AS sender_name FROM scheduled_messages s JOIN members m ON m.id = s.sender_id
       WHERE s.org_id IN (${orgs.map(() => "?").join(",")}) AND (s.sent_at IS NULL OR (s.reminder_at IS NOT NULL AND s.reminder_sent_at IS NULL))
       ORDER BY COALESCE(CASE WHEN s.sent_at IS NULL THEN s.send_at END, s.reminder_at)`,
    )
    .all(...orgs) as (ScheduledMessage & { sender_name: string })[];
  return rows.map((r) => ({ ...r, audience_label: audienceLabel(r.org_id, r.audience) }));
}

/** One the leader may change: in an organization they lead, not fully sent. */
export function editableScheduled(id: number, viewerId: number): ScheduledMessage | undefined {
  const s = db().prepare("SELECT * FROM scheduled_messages WHERE id = ?").get(id) as ScheduledMessage | undefined;
  return s && ledOrgIds(viewerId).includes(s.org_id) && (!s.sent_at || (s.reminder_at && !s.reminder_sent_at)) ? s : undefined;
}

/** New wording or times. A message already sent keeps its time; only its reminder can change. */
export function updateScheduled(id: number, viewerId: number, change: { title: string; body: string; send_at: string; reminder_at: string | null }): boolean {
  const s = editableScheduled(id, viewerId);
  if (!s) return false;
  db()
    .prepare("UPDATE scheduled_messages SET title = ?, body = ?, send_at = ?, reminder_at = ? WHERE id = ?")
    .run(change.title, change.body, s.sent_at ? s.send_at : change.send_at, change.reminder_at, s.id);
  return true;
}

/** Cancels what hasn't gone out (a sent message's reminder, or all of it). */
export function cancelScheduled(id: number, viewerId: number): boolean {
  const s = editableScheduled(id, viewerId);
  if (!s) return false;
  if (s.sent_at) db().prepare("UPDATE scheduled_messages SET reminder_at = NULL WHERE id = ?").run(s.id);
  else db().prepare("DELETE FROM scheduled_messages WHERE id = ?").run(s.id);
  return true;
}

/**
 * Sends what's due: scheduled messages, then their reminders ("Reminder: …", the same
 * words). Each is marked first, so it never goes twice. Returns how many went out.
 */
export async function sendDueScheduled(now: DateTime = DateTime.utc()): Promise<number> {
  const d = db();
  // Same form as saved times ("…T16:00:00Z", no milliseconds), so they compare as text.
  const iso = now.toUTC().startOf("second").toISO({ suppressMilliseconds: true })!;
  let sent = 0;
  const due = d
    .prepare("SELECT * FROM scheduled_messages WHERE (sent_at IS NULL AND send_at <= ?) OR (sent_at IS NOT NULL AND reminder_at IS NOT NULL AND reminder_sent_at IS NULL AND reminder_at <= ?) ORDER BY id")
    .all(iso, iso) as ScheduledMessage[];
  for (const s of due) {
    const reminder = !!s.sent_at;
    const claimed = reminder
      ? d.prepare("UPDATE scheduled_messages SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL").run(iso, s.id).changes
      : d.prepare("UPDATE scheduled_messages SET sent_at = ? WHERE id = ? AND sent_at IS NULL").run(iso, s.id).changes;
    if (!claimed) continue;
    // A leader released since: it isn't sent in their name.
    if (!ledOrgIds(s.sender_id).includes(s.org_id)) continue;
    const tz = getWard(getOrg(s.org_id)?.ward_id ?? 0)?.timezone ?? "America/Boise";
    const res = await sendToAudience({
      orgId: s.org_id,
      senderId: s.sender_id,
      audience: s.audience,
      title: reminder ? `Reminder: ${s.title}` : s.title,
      body: s.body,
      link: s.link,
      tz,
      ...(s.flyer_file ? { flyer: { file: s.flyer_file, name: s.flyer_name ?? "Flyer" } } : {}),
    });
    if (!reminder) d.prepare("UPDATE scheduled_messages SET sent_message_id = ? WHERE id = ?").run(res.messageId ?? null, s.id);
    sent++;
  }
  return sent;
}
