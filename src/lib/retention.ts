import { db } from "./db";
import { deleteAccount } from "./accounts";

// How long member-contributed information is kept. Shown to members on /privacy.
const ISO_NOW_MINUS = (modifier: string) => `strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '${modifier}')`;

/** Deletes old personal information. Runs once a day from the scheduler. */
export function runRetention() {
  const d = db();
  const counts: Record<string, number> = {};
  const run = (label: string, sql: string) => {
    counts[label] = d.prepare(sql).run().changes;
  };
  d.transaction(() => {
    // Sign-ups: 30 days after their date (180 days after creation if undated).
    run("signups", `DELETE FROM signups WHERE (date IS NOT NULL AND date < date('now', '-30 days')) OR (date IS NULL AND created_at < datetime('now', '-180 days'))`);
    // People without an account who signed up: 30 days after the date (gone with it, above),
    // after 90 days for undated ones, and sign-ups never confirmed with the code after a day.
    run(
      "guests",
      `DELETE FROM signup_guests WHERE (confirmed_at IS NULL AND created_at < datetime('now', '-1 day'))
         OR (confirmed_at < datetime('now', '-90 days') AND slot_id IN (SELECT sl.id FROM signup_slots sl JOIN signups s ON s.id = sl.signup_id WHERE s.date IS NULL))`,
    );
    // RSVPs and event requests: 30 days after the event.
    run("rsvps", `DELETE FROM event_rsvps WHERE event_id IN (SELECT id FROM events WHERE ends_at < ${ISO_NOW_MINUS("-30 days")})`);
    run("event_requests", `DELETE FROM event_requests WHERE starts_at < ${ISO_NOW_MINUS("-30 days")}`);
    // Offers to teach: 30 days after the lesson.
    run("volunteers", `DELETE FROM lesson_volunteers WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-30 days'))`);
    run("teaching_requests", `DELETE FROM teaching_requests WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-30 days'))`);
    run("declines", `DELETE FROM lesson_declines WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-30 days'))`);
    // Comments: 6 months after the lesson; comments that weren't posted after 30 days.
    run("comments", `DELETE FROM comments WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-6 months')) OR (status = 'rejected' AND created_at < datetime('now', '-30 days'))`);
    // Teacher notes: 6 months after the lesson.
    run("teacher_notes", `DELETE FROM lesson_notes WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-6 months'))`);
    // Unanswered join requests after 60 days.
    run("requests", `DELETE FROM members WHERE status = 'pending' AND updated_at < datetime('now', '-60 days')`);
    // Text counts after 90 days (they hold no numbers or messages); unused confirmation codes after a day.
    run("sms_log", `DELETE FROM sms_log WHERE sent_at < datetime('now', '-90 days')`);
    run("contact_codes", `DELETE FROM contact_verifications WHERE created_at < datetime('now', '-1 day')`);
    // Visit requests: 30 days after they're finished; unanswered ones after 6 months.
    run("visit_requests", `DELETE FROM visit_requests WHERE (status IN ('done','closed','cancelled') AND updated_at < datetime('now', '-30 days')) OR created_at < datetime('now', '-6 months')`);
    // Planned visits that were never recorded or cancelled: 30 days after their date.
    run("planned_visits", `DELETE FROM planned_visits WHERE date < date('now', '-30 days')`);
    // Conversations between members and the presidency after 6 months.
    run("member_messages", `DELETE FROM member_messages WHERE created_at < datetime('now', '-6 months')`);
    // The Reminders & alerts list (and messages' log entries) after 30 days.
    run("notification_log", `DELETE FROM notification_log WHERE created_at < datetime('now', '-30 days')`);
    // Message history after a year.
    run("messages", `DELETE FROM messages WHERE created_at < datetime('now', '-365 days')`);
  })();
  // Members who haven't signed in for 12 months (leaders are kept).
  const stale = d
    .prepare(
      `SELECT id FROM members WHERE status != 'pending' AND julianday(coalesce(last_login_at, created_at)) < julianday('now', '-365 days')
       AND NOT EXISTS (SELECT 1 FROM org_members om WHERE om.member_id = members.id AND om.role <> 'member')`,
    )
    .all() as { id: number }[];
  for (const m of stale) deleteAccount(m.id);
  counts.accounts = stale.length;
  return counts;
}
