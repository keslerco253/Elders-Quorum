import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { EventForm } from "../event-form";
import { deleteEvent } from "../actions";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const e = getEvent(user, Number((await params).id));
  if (!e) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Edit event" back={{ href: `/calendar/${e.id}`, label: "Event" }} />
      <Flash msg={sp.msg} />
      <EventForm e={e} tz={user.ward.timezone} />
      <form action={deleteEvent} className="mt-4">
        <input type="hidden" name="id" value={e.id} />
        <SubmitButton className="btn-danger btn-sm" confirm="Delete this event?">
          Delete event
        </SubmitButton>
      </form>
    </>
  );
}
