import { requireAdmin } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { EventForm } from "../event-form";
import { announceChoices, inviteChoicesFor, wardPeople } from "@/lib/announce";

export const metadata = { title: "Add event" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const invites = inviteChoicesFor(user);
  const announceTo = announceChoices(user, [], { invites: !!invites?.length });

  return (
    <>
      <PageHeader title="Add event" back={{ href: "/calendar", label: "Calendar" }} />
      <Flash msg={sp.msg} tone="danger" />
      <EventForm announceTo={announceTo} inviteChoices={invites} people={wardPeople(user.ward_id)} tz={user.ward.timezone} date={/^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date : undefined} />
    </>
  );
}
