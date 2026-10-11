import { requireUser } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { requestEvent } from "../actions";

export const metadata = { title: "Request an event" };

export default async function RequestEventPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Request an event" back={{ href: "/calendar", label: "Calendar" }} subtitle="Suggest an activity or meeting. The presidency will review it, and you'll be notified when it's approved or declined." />
      <Flash msg={sp.msg} tone="danger" />
      <form action={requestEvent} className="card max-w-2xl space-y-4">
        <div>
          <label className="label" htmlFor="title">
            What is it?
          </label>
          <input id="title" name="title" required className="input" placeholder="e.g. Quorum basketball night" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="starts_at">
              Starts
            </label>
            <input id="starts_at" name="starts_at" type="datetime-local" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ends_at">
              Ends
            </label>
            <input id="ends_at" name="ends_at" type="datetime-local" required className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="location">
            Where
          </label>
          <input id="location" name="location" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="description">
            Details
          </label>
          <textarea id="description" name="description" rows={4} className="input" placeholder="What's planned, who it's for, anything to bring" />
        </div>
        <SubmitButton pendingText="Sending…">Send request</SubmitButton>
      </form>
    </>
  );
}
