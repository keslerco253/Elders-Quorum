import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { PersonalReminders } from "@/components/personal-reminders";
import { MAX_TODO_REMINDERS, MAX_TODO_TEXTS, todoReminders } from "@/lib/personal-todos";
import { PERSONAL_EVENT_WHEN, STARTING_EVENT_REMINDERS, type PersonalEvent } from "@/lib/personal-events";
import { savePersonalEventAction } from "./actions";
import { PersonalTimeFields } from "./time-fields";

/** A member's own calendar event: what, when, where, notes and its reminders. */
export function PersonalEventForm({
  event,
  date,
  canText,
  textReady,
  canEmail,
}: {
  event?: PersonalEvent;
  /** A new event's date (from the day picked on the calendar). */
  date?: string;
  canText: boolean;
  textReady: boolean;
  canEmail: boolean;
}) {
  return (
    <form action={savePersonalEventAction} className="card max-w-xl space-y-3">
      {event && <input type="hidden" name="item_id" value={event.id} />}
      <p className="flex gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
        <span aria-hidden>🔒</span>
        <span>
          <strong>Only you can see this event.</strong> It&apos;s on your calendar and Home, not anyone else&apos;s: not your presidency, the bishopric or ward administrators.
        </span>
      </p>
      <input name="title" required maxLength={200} className="input" placeholder="What is it?" defaultValue={event?.title} aria-label="Title" />
      <input name="date" type="date" required className="input" defaultValue={event?.date ?? date ?? ""} aria-label="Date" />
      <PersonalTimeFields allDay={!!event?.all_day} start={event && !event.all_day ? event.start_time : ""} end={event?.end_time ?? ""} />
      <input name="location" maxLength={200} className="input" placeholder="Where (optional)" defaultValue={event?.location} aria-label="Where" />
      <textarea name="notes" rows={3} className="input" placeholder="Notes (optional)" defaultValue={event?.notes} aria-label="Notes" />
      <PersonalReminders
        options={PERSONAL_EVENT_WHEN}
        initial={event ? todoReminders(event) : STARTING_EVENT_REMINDERS}
        canText={canText}
        textReady={textReady}
        canEmail={canEmail}
        max={MAX_TODO_REMINDERS}
        maxTexts={MAX_TODO_TEXTS}
      />
      <div className="flex gap-2">
        <SubmitButton>{event ? "Save" : "Add to my calendar"}</SubmitButton>
        <Link href="/calendar" className="btn-secondary">
          Cancel
        </Link>
      </div>
      <p className="hint">Reminders go only to you, counted from when it starts (9 AM for an all-day event).</p>
    </form>
  );
}
