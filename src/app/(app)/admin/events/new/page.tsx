import { requireAdmin } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { EventForm } from "../event-form";
import { orgGroups } from "@/lib/groups";
import { leadersWord } from "@/lib/types";

export const metadata = { title: "Add event" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const announceTo = [
    { value: "everyone", label: `Everyone in ${user.orgLabel}` },
    { value: "presidency", label: `Just the ${leadersWord(user.org)}` },
    ...orgGroups(user.org_id).map((g) => ({ value: `group:${g.id}`, label: `${g.name} (${g.n} ${g.n === 1 ? "person" : "people"})` })),
  ];
  return (
    <>
      <PageHeader title="Add event" back={{ href: "/calendar", label: "Calendar" }} />
      <Flash msg={sp.msg} tone="danger" />
      <EventForm announceTo={announceTo} tz={user.ward.timezone} date={/^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date : undefined} />
    </>
  );
}
