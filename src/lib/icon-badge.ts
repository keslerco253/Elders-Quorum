import { unreadAnswers, leaderUnread } from "./conversations";
import { unreadAnnouncements } from "./member-inbox";
import { unreadNotifications } from "./notification-log";

/**
 * The number on the app's icon: what's waiting to be read, the same as the red dots on
 * Messages and More (unread messages, answers and announcements, and reminders and alerts).
 */
export function iconBadgeCount(memberId: number): number {
  return unreadNotifications(memberId) + unreadAnswers(memberId) + unreadAnnouncements(memberId) + leaderUnread(memberId);
}
