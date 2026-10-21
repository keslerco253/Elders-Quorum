import Link from "next/link";

/** "🔔 My reminders" for one area (lessons, events, service). */
export function RemindersLink({ kind }: { kind: "lessons" | "events" | "service" }) {
  return (
    <Link href={`/more/reminders#${kind}`} className="btn-secondary" aria-label="My reminders">
      🔔 My reminders
    </Link>
  );
}
