import { notFound } from "next/navigation";
import { requireEventEditor } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { getOrgEvent } from "@/lib/events";
import { getSeries } from "@/lib/event-series";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { EventForm } from "../event-form";
import {
  announceChoices,
  inviteChoicesFor,
  wardPeople,
  withSameAsBefore,
  invitedNames,
} from "@/lib/announce";
import { deleteEvent, saveReminderWording } from "../actions";
import { renderTemplate } from "@/lib/templates";
import { eventWhenText } from "@/lib/events";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireEventEditor();
  const e = getOrgEvent(user, Number((await params).id));
  if (!e) notFound();
  const sp = await searchParams;
  const series = getSeries(user.org_id, e.series_id);
  const people = wardPeople(user.ward_id);
  const usual = renderTemplate(e.org_id, "event_reminder", { event: e.title, date_time: eventWhenText(e, user.ward.timezone), location: e.location });
  return (
    <>
      <PageHeader
        title="Edit event"
        back={{ href: `/calendar/${e.id}`, label: "Event" }}
      />
      <Flash msg={sp.msg} />
      <EventForm
        e={e}
        tz={user.ward.timezone}
        leadersOnly={isAdmin(user)}
        series={series}
        announceTo={withSameAsBefore(
          announceChoices(
            user,
            e.rsvp_enabled
              ? [{ value: "rsvp", label: "Everyone who said Going or Maybe" }]
              : [],
            { invites: !!inviteChoicesFor(user)?.length || !!e.invited, invitedNames: invitedNames(e.invited) },
          ),
          e.announced_to,
          people,
        )}
        people={people}
        inviteChoices={inviteChoicesFor(user)}
      />
      {/* One time: this event's reminders in other words (it changed a little). */}
      <form action={saveReminderWording} className="card mt-4 max-w-2xl space-y-2">
        <input type="hidden" name="event_id" value={e.id} />
        <label className="label" htmlFor="reminder-text">
          Reminder wording, this event only <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="reminder-text" name="reminder_text" rows={3} maxLength={300} defaultValue={e.reminder_text ?? ""} className="input" placeholder={`Usually: "${usual.title}. ${usual.body}"`} />
        <p className="hint">
          Its reminders (text, notification and email) will say just this, e.g. &ldquo;The party starts at 6:30 now, not 6, and it&apos;s in the gym.&rdquo; Texts start with your organization&apos;s name and end with the link. Leave it empty for the usual wording. Reminders already sent aren&apos;t changed; to tell people right away, use{" "}
          <strong>Send an update</strong> above.
        </p>
        <SubmitButton className="btn-secondary btn-sm">Save reminder wording</SubmitButton>
      </form>
      <form action={deleteEvent} className="mt-4">
        <input type="hidden" name="item_id" value={e.id} />
        {series ? (
          <div className="flex flex-wrap gap-2">
            <SubmitButton
              name="scope"
              value="this"
              className="btn-danger btn-sm"
              confirm="Delete only this date?"
            >
              Delete only this date
            </SubmitButton>
            <SubmitButton
              name="scope"
              value="future"
              className="btn-danger btn-sm"
              confirm="Delete this and all future dates?"
            >
              Delete this and all future dates
            </SubmitButton>
          </div>
        ) : (
          <SubmitButton
            className="btn-danger btn-sm"
            confirm="Delete this event?"
          >
            Delete event
          </SubmitButton>
        )}
      </form>
    </>
  );
}
