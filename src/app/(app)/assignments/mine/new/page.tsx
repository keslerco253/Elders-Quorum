import { requireUser } from "@/lib/auth";
import { canTextTodos } from "@/lib/personal-todos";
import { memberCanText } from "../../../more/reminders/can-text";
import { Flash, PageHeader } from "@/components/ui";
import { TodoForm } from "../todo-form";

export const metadata = { title: "My to-do" };

export default async function NewTodoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New to-do" back={{ href: "/assignments", label: "My assignments" }} subtitle="Private: only you can see it." />
      <Flash msg={sp.msg} tone="warn" />
      <TodoForm canText={canTextTodos(user.id)} textReady={memberCanText(user)} canEmail={!!user.email} />
    </>
  );
}
