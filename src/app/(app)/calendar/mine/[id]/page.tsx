import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canTextTodos } from "@/lib/personal-todos";
import { getPersonalEvent } from "@/lib/personal-events";
import { memberCanText } from "../../../more/reminders/can-text";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { PersonalEventForm } from "../event-form";
import { deletePersonalEventAction } from "../actions";

export const metadata = { title: "My event" };

export default async function PersonalEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const event = getPersonalEvent(user.id, Number((await params).id));
  if (!event) notFound();
  return (
    <>
      <PageHeader title="My event" back={{ href: `/calendar?m=${event.date.slice(0, 7)}&d=${event.date}#day`, label: "Calendar" }} subtitle="Private: only you can see it." />
      <Flash msg={sp.msg} tone="warn" />
      <form action={deletePersonalEventAction} className="mb-4">
        <input type="hidden" name="item_id" value={event.id} />
        <SubmitButton className="btn-secondary" confirm="Delete this event?" pendingText="…">
          Delete
        </SubmitButton>
      </form>
      <PersonalEventForm key={event.id} event={event} canText={canTextTodos(user.id)} textReady={memberCanText(user)} canEmail={!!user.email} />
    </>
  );
}
