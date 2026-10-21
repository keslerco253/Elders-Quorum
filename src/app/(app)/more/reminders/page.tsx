import { requireUser } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { getReminderSettings, KIND_LABELS, MAX_REMINDERS, MAX_TEXTS, STARTING_REMINDERS, WHEN_OPTIONS, type ReminderKind } from "@/lib/reminder-prefs";
import { ReminderEditor } from "./reminder-editor";
import { saveReminders } from "./actions";
import { memberCanText } from "./can-text";

export const metadata = { title: "My reminders" };

const SCHEDULED: Record<ReminderKind, string> = {
  lessons: "Sunday evening about the next Sunday's lesson, and Saturday morning.",
  events: "Whatever reminders your leaders set for each event (usually the day before).",
  service: "For what you signed up for: usually a week and a day before, at 8 AM.",
};

export default async function MyRemindersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const canText = memberCanText(user);
  return (
    <>
      <PageHeader title="My reminders" back={{ href: "/more", label: "More" }} subtitle="How and when you're reminded about lessons, events and service. Each area can be different." />
      <Flash msg={sp.msg} tone="success" />
      <Flash msg={sp.error} tone="danger" />
      <div className="max-w-2xl space-y-4">
        {(["lessons", "events", "service"] as const).map((kind) => (
          <ReminderEditor
            key={kind}
            kind={kind}
            title={KIND_LABELS[kind]}
            scheduledText={SCHEDULED[kind]}
            options={WHEN_OPTIONS[kind]}
            starting={STARTING_REMINDERS[kind]}
            initial={getReminderSettings(user.id, kind)}
            canText={canText}
            maxTexts={MAX_TEXTS}
            maxReminders={MAX_REMINDERS}
            action={saveReminders}
          />
        ))}
      </div>
    </>
  );
}
