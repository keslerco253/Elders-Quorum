import { requireAdmin } from "@/lib/auth";
import { Flash, PageHeader } from "@/components/ui";
import { EventForm } from "../event-form";

export const metadata = { title: "Add event" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Add event" back={{ href: "/calendar", label: "Calendar" }} />
      <Flash msg={sp.msg} tone="danger" />
      <EventForm tz={user.ward.timezone} date={/^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date : undefined} />
    </>
  );
}
