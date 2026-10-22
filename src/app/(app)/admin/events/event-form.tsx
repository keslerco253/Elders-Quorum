import { REMINDER_OPTIONS } from "@/lib/events";
import { utcToLocalInput } from "@/lib/time";
import type { EventRow } from "@/lib/types";
import type { SeriesRow } from "@/lib/event-series";
import { RepeatFields } from "@/components/repeat-fields";
import { SubmitButton } from "@/components/client";
import { saveEvent } from "./actions";
import { FlyerField } from "@/components/flyer-field";
import { AnnounceField } from "@/components/announce-field";

/** `date` (yyyy-mm-dd) pre-fills a new event for that day, 7–8 PM. */
/** `announceTo`: who can be told about the new event, or sent an update about a change. */
export function EventForm({
  e,
  tz,
  date,
  series,
  announceTo,
  inviteChoices,
  people,
}: {
  e?: EventRow;
  tz: string;
  date?: string;
  series?: SeriesRow;
  announceTo?: { value: string; label: string }[];
  /** The ward's other organizations, which an organization's event can invite. */
  inviteChoices?: { id: number; label: string }[];
  /** People in the ward, to add to a notification by name. */
  people?: { id: number; name: string }[];
}) {
  const invited = new Set((e?.invited ?? "").split(",").filter(Boolean));
  const startValue = e
    ? utcToLocalInput(e.starts_at, tz)
    : date
      ? `${date}T19:00`
      : "";
  return (
    <form action={saveEvent} className="card max-w-2xl space-y-4">
      {e && <input type="hidden" name="item_id" value={e.id} />}
      {series && (
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-semibold">
            This is a repeating event. Save changes to:
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scope" value="this" defaultChecked /> Only
            this date
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scope" value="future" /> This and all
            future dates
          </label>
          <p className="hint">
            Changing the time or how it repeats for future dates clears RSVPs on
            those dates.
          </p>
        </fieldset>
      )}
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          className="input"
          defaultValue={e?.title}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="starts_at">
            Starts
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            className="input"
            defaultValue={startValue}
          />
        </div>
        <div>
          <label className="label" htmlFor="ends_at">
            Ends
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            required
            className="input"
            defaultValue={
              e ? utcToLocalInput(e.ends_at, tz) : date && `${date}T20:00`
            }
          />
        </div>
        <p className="hint sm:col-span-2">
          Something that runs for days or months, like a temple open house? Set it to end on the last day. It shows as &ldquo;going on&rdquo; at the top of
          the calendar each month and as &ldquo;Now through …&rdquo; on members&apos; home pages, instead of on one day.
        </p>
      </div>
      <RepeatFields
        initialStart={startValue}
        defaultPattern={series?.pattern ?? ""}
        defaultEnd={
          series?.until_date ? "until" : series?.max_count ? "count" : "never"
        }
        defaultUntil={series?.until_date ?? ""}
        defaultCount={series?.max_count ?? 12}
      />
      <div>
        <label className="label" htmlFor="location">
          Location
        </label>
        <input
          id="location"
          name="location"
          className="input"
          defaultValue={e?.location}
        />
      </div>
      <div>
        <label className="label" htmlFor="description">
          Details
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="input"
          defaultValue={e?.description}
        />
      </div>
      <FlyerField
        file={e?.flyer_file}
        name={e?.flyer_name}
        hint="A PDF or a picture, up to 15 MB. It shows on the event's page, with a small preview on members' home pages."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="reminder_minutes">
            Reminder
          </label>
          <select
            id="reminder_minutes"
            name="reminder_minutes"
            className="input"
            defaultValue={e ? String(e.reminder_minutes ?? "") : "1440"}
          >
            {REMINDER_OPTIONS.map(([v, label]) => (
              <option key={label} value={v ?? ""}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reminder2_minutes">
            Second reminder
          </label>
          <select
            id="reminder2_minutes"
            name="reminder2_minutes"
            className="input"
            defaultValue={e ? String(e.reminder2_minutes ?? "") : ""}
          >
            {REMINDER_OPTIONS.map(([v, label]) => (
              <option key={label} value={v ?? ""}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {inviteChoices && inviteChoices.length > 0 && (
        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-semibold">
            Invite other organizations (optional)
          </legend>
          <p className="hint mt-0 mb-2">
            They see it on their calendar, get its reminders and can RSVP. It
            stays your event; only you can change it.
          </p>
          <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="invite"
                value="ward"
                defaultChecked={invited.has("ward")}
              />{" "}
              <strong>The whole ward</strong>
            </label>
            {inviteChoices.map((o) => (
              <label key={o.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="invite"
                  value={o.id}
                  defaultChecked={invited.has(String(o.id))}
                />{" "}
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="presidency_only"
          defaultChecked={!!e?.presidency_only}
          className="mt-1"
        />
        <span>
          <strong>Leaders only</strong>
          <span className="block text-muted">
            Hidden from members. Visible to this organization&apos;s leaders
            only.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="rsvp_enabled"
          defaultChecked={!!e?.rsvp_enabled}
          className="mt-1"
        />
        <span>
          <strong>Ask people to RSVP</strong>
          <span className="block text-muted">
            Shows Going / Maybe / Can&apos;t go buttons.
          </span>
        </span>
      </label>
      {announceTo && (
        <AnnounceField
          choices={announceTo}
          people={people ?? []}
          label={e ? "Send an update" : "Send a notification"}
          about={
            e
              ? "Lets people know about the change (the new date, time and place) when you save."
              : "Lets people know about the new event as soon as you save it."
          }
          hint="For a leaders-only event, only the leaders are notified."
        />
      )}
      <SubmitButton>Save event</SubmitButton>
    </form>
  );
}
