import { db } from "./db";

export interface LoggedNotification {
  id: number;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
}

/** The member's notifications, newest first (kept 30 days). */
export function notificationsFor(memberId: number, limit = 60): LoggedNotification[] {
  return db().prepare("SELECT * FROM notification_log WHERE member_id = ? ORDER BY id DESC LIMIT ?").all(memberId, limit) as LoggedNotification[];
}

export function unreadNotifications(memberId: number): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM notification_log WHERE member_id = ? AND read_at IS NULL").get(memberId) as { n: number }).n;
}

/** Marks one notification read (only the member's own), or all of them. */
export function markNotificationsRead(memberId: number, id?: number) {
  if (id) db().prepare("UPDATE notification_log SET read_at = datetime('now') WHERE id = ? AND member_id = ? AND read_at IS NULL").run(id, memberId);
  else db().prepare("UPDATE notification_log SET read_at = datetime('now') WHERE member_id = ? AND read_at IS NULL").run(memberId);
}
