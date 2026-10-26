import { requireUser } from "@/lib/auth";
import { canTextTodos } from "@/lib/personal-todos";
import { memberCanText } from "../../../more/reminders/can-text";
import { Flash, PageHeader } from "@/components/ui";
import { PersonalEventForm } from "../event-form";

export const metadata = { title: "My event" };

export default async function NewPersonalEventPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date : undefined;
  return (
    <>
      <PageHeader title="New event" back={{ href: "/calendar", label: "Calendar" }} subtitle="On your calendar only: private to you." />
      <Flash msg={sp.msg} tone="warn" />
      <PersonalEventForm date={date} canText={canTextTodos(user.id)} textReady={memberCanText(user)} canEmail={!!user.email} />
    </>
  );
}
