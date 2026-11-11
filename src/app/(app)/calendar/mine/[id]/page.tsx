import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canTextTodos } from "@/lib/personal-todos";
import { eventImages, getPersonalEvent, occurrences, repeatText } from "@/lib/personal-events";
import { formatDate } from "@/lib/time";
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
  // Opened from one date of a repeating event.
  const on = event.repeat && /^\d{4}-\d{2}-\d{2}$/.test(sp.on ?? "") && occurrences(event, sp.on, sp.on).length ? sp.on : null;
  const day = on ?? event.date;
  const repeats = repeatText(event);
  return (
    <>
      <PageHeader title="My event" back={{ href: `/calendar?m=${day.slice(0, 7)}&d=${day}#day`, label: "Calendar" }} subtitle="Private: only you can see it." />
      <Flash msg={sp.msg} tone="warn" />
      {repeats && (
        <p className="mb-3 text-sm">
          🔁 {repeats}.{on && ` This is the one on ${formatDate(on, "short")}.`} Changes below apply to every date.
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {on && (
          <form action={deletePersonalEventAction}>
            <input type="hidden" name="item_id" value={event.id} />
            <input type="hidden" name="on" value={on} />
            <SubmitButton className="btn-secondary" confirm={`Take off just ${formatDate(on, "short")}?`} pendingText="…">
              Delete just {formatDate(on, "short")}
            </SubmitButton>
          </form>
        )}
        <form action={deletePersonalEventAction}>
          <input type="hidden" name="item_id" value={event.id} />
          <SubmitButton className="btn-secondary" confirm={repeats ? "Delete this event and every date it repeats?" : "Delete this event?"} pendingText="…">
            {repeats ? "Delete every date" : "Delete"}
          </SubmitButton>
        </form>
      </div>
      {eventImages(event).length > 0 && (
        <div className="mb-4 flex max-w-xl flex-wrap gap-3">
          {eventImages(event).map((name) => (
            <a key={name} href={`/calendar/mine/${event.id}/picture/${name}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/calendar/mine/${event.id}/picture/${name}`} alt="The picture this event was made from" className="h-48 w-auto object-contain" />
            </a>
          ))}
        </div>
      )}
      <PersonalEventForm key={event.id} event={event} canText={canTextTodos(user.id)} textReady={memberCanText(user)} canEmail={!!user.email} />
    </>
  );
}
