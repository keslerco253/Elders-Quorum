import { db } from "./db";
import { withSeen } from "./notify";
import { withOrg } from "./org-cookie";

export interface LoggedNotification {
  id: number;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
}

/** The member's reminders and alerts (not messages, which are in Messages), newest first (kept 30 days). */
export function notificationsFor(memberId: number, limit = 60): LoggedNotification[] {
  return db().prepare("SELECT * FROM notification_log WHERE member_id = ? AND message = 0 ORDER BY id DESC LIMIT ?").all(memberId, limit) as LoggedNotification[];
}

export function unreadNotifications(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM notification_log WHERE member_id = ? AND read_at IS NULL AND message = 0").get(memberId) as { n: number }).n;
}

/** Marks one notification read (only the member's own), or all of them. */
export function markNotificationsRead(memberId: number, id?: number) {
  if (id) db().prepare("UPDATE notification_log SET read_at = datetime('now') WHERE id = ? AND member_id = ? AND read_at IS NULL").run(id, memberId);
  else db().prepare("UPDATE notification_log SET read_at = datetime('now') WHERE member_id = ? AND read_at IS NULL").run(memberId);
}

/** Where a texted short link (/n/<id>) goes for this viewer: the notification's page if it was sent to them, else home. */
export function shortLinkTarget(id: number, viewerId: number | null): string {
  if (!Number.isInteger(id) || !viewerId) return "/";
  const row = db().prepare("SELECT url, org_id, member_id FROM notification_log WHERE id = ?").get(id) as { url: string; org_id: number | null; member_id: number } | undefined;
  return row && row.member_id === viewerId && row.url.startsWith("/") ? withOrg(withSeen(row.url, id), row.org_id) : "/";
}
