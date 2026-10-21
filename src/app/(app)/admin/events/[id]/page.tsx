import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
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
} from "@/lib/announce";
import { deleteEvent } from "../actions";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireAdmin();
  const e = getOrgEvent(user, Number((await params).id));
  if (!e) notFound();
  const sp = await searchParams;
  const series = getSeries(user.org_id, e.series_id);
  const people = wardPeople(user.ward_id);
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
        series={series}
        announceTo={withSameAsBefore(
          announceChoices(
            user,
            e.rsvp_enabled
              ? [{ value: "rsvp", label: "Everyone who said Going or Maybe" }]
              : [],
            { invites: !!inviteChoicesFor(user)?.length },
          ),
          e.announced_to,
          people,
        )}
        people={people}
        inviteChoices={inviteChoicesFor(user)}
      />
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
