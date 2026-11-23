import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SupportNotice } from "@/components/support-notice";
import { eventOrgChoices, sayEventConfigured } from "@/lib/say-event";
import { SayEvent } from "./say-event";

export const metadata = { title: "Say an event" };

/** 🎤 Say an event: say (or type) it; the app asks for anything missing, then adds it. */
export default async function SayEventPage() {
  const user = await requireUser();
  if (user.support) return <SupportNotice user={user} title="Say an event" what="Events are added by the ward's own members and leaders." />;
  const choices = eventOrgChoices(user.id, user.wardAdmin ? user.ward_id : null);
  return (
    <>
      <PageHeader title="🎤 Say an event" back={{ href: "/calendar", label: "Calendar" }} subtitle={choices.length ? "For your own calendar, or one you add events to." : "It goes on your own calendar (only you see it)."} />
      {sayEventConfigured() ? (
        <SayEvent choices={choices} />
      ) : (
        <p className="card max-w-xl text-sm">Saying an event isn&apos;t set up on this server yet. Use + My event{choices.length ? " or Add event" : ""} on the Calendar.</p>
      )}
    </>
  );
}
