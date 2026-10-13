import { REMINDER_OPTIONS } from "@/lib/events";
import { utcToLocalInput } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import { SubmitButton } from "@/components/client";
import { saveEvent } from "./actions";

/** `date` (yyyy-mm-dd) pre-fills a new event for that day, 7–8 PM. */
export function EventForm({ e, tz, date }: { e?: EventRow; tz: string; date?: string }) {
  return (
    <form action={saveEvent} className="card max-w-2xl space-y-4">
      {e && <input type="hidden" name="item_id" value={e.id} />}
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" required className="input" defaultValue={e?.title} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="starts_at">
            Starts
          </label>
          <input id="starts_at" name="starts_at" type="datetime-local" required className="input" defaultValue={e ? utcToLocalInput(e.starts_at, tz) : date && `${date}T19:00`} />
        </div>
        <div>
          <label className="label" htmlFor="ends_at">
            Ends
          </label>
          <input id="ends_at" name="ends_at" type="datetime-local" required className="input" defaultValue={e ? utcToLocalInput(e.ends_at, tz) : date && `${date}T20:00`} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="location">
          Location
        </label>
        <input id="location" name="location" className="input" defaultValue={e?.location} />
      </div>
      <div>
        <label className="label" htmlFor="description">
          Details
        </label>
        <textarea id="description" name="description" rows={4} className="input" defaultValue={e?.description} />
      </div>
      <div>
        <label className="label" htmlFor="reminder_minutes">
          Reminder
        </label>
        <select id="reminder_minutes" name="reminder_minutes" className="input" defaultValue={e ? String(e.reminder_minutes ?? "") : "1440"}>
          {REMINDER_OPTIONS.map(([v, label]) => (
            <option key={label} value={v ?? ""}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="presidency_only" defaultChecked={!!e?.presidency_only} className="mt-1" />
        <span>
          <strong>Presidency only</strong>
          <span className="block text-muted">Hidden from members. Visible to the presidency and admins only.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="rsvp_enabled" defaultChecked={!!e?.rsvp_enabled} className="mt-1" />
        <span>
          <strong>Ask people to RSVP</strong>
          <span className="block text-muted">Shows Going / Maybe / Can&apos;t go buttons.</span>
        </span>
      </label>
      <SubmitButton>Save event</SubmitButton>
    </form>
  );
}
