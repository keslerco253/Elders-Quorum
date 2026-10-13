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
    // RSVPs and event requests: 30 days after the event.
    run("rsvps", `DELETE FROM event_rsvps WHERE event_id IN (SELECT id FROM events WHERE ends_at < ${ISO_NOW_MINUS("-30 days")})`);
    run("event_requests", `DELETE FROM event_requests WHERE starts_at < ${ISO_NOW_MINUS("-30 days")}`);
    // Offers to teach: 30 days after the lesson.
    run("volunteers", `DELETE FROM lesson_volunteers WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-30 days'))`);
    // Comments: 6 months after the lesson; comments that weren't posted after 30 days.
    run("comments", `DELETE FROM comments WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-6 months')) OR (status = 'rejected' AND created_at < datetime('now', '-30 days'))`);
    // Teacher notes: 6 months after the lesson.
    run("teacher_notes", `DELETE FROM lesson_notes WHERE lesson_id IN (SELECT id FROM lessons WHERE date < date('now', '-6 months'))`);
    // Unanswered join requests after 60 days.
    run("requests", `DELETE FROM members WHERE status = 'pending' AND updated_at < datetime('now', '-60 days')`);
    // Message history after a year.
    run("messages", `DELETE FROM messages WHERE created_at < datetime('now', '-365 days')`);
  })();
  // Members who haven't signed in for 12 months (leaders are kept).
  const stale = d
    .prepare(`SELECT id FROM members WHERE role = 'member' AND status != 'pending' AND julianday(coalesce(last_login_at, created_at)) < julianday('now', '-365 days')`)
    .all() as { id: number }[];
  for (const m of stale) deleteAccount(m.id);
  counts.accounts = stale.length;
  return counts;
}
