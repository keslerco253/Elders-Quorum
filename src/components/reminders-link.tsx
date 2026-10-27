import type { ReminderKind } from "@/lib/reminder-prefs";
import Link from "next/link";

/** "🔔 Reminder settings" for one area (lessons, events, service, assignments). */
export function RemindersLink({ kind }: { kind: ReminderKind }) {
  return (
    <Link href={`/more/reminders#${kind}`} className="btn-secondary" aria-label="Reminder settings">
      🔔 Reminder settings
    </Link>
  );
}
