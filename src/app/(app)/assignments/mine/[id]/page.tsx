import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPersonalTodo, personalChannels } from "@/lib/personal-todos";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { TodoForm } from "../todo-form";
import { deletePersonal, donePersonal } from "../actions";

export const metadata = { title: "My to-do" };

export default async function TodoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const todo = getPersonalTodo(user.id, Number((await params).id));
  if (!todo) notFound();
  return (
    <>
      <PageHeader title={todo.done ? "Done" : "My to-do"} back={{ href: "/assignments", label: "My assignments" }} subtitle="Only you can see this." />
      <Flash msg={sp.msg} tone="warn" />
      <div className="mb-4 flex max-w-xl flex-wrap gap-2">
        <form action={donePersonal}>
          <input type="hidden" name="item_id" value={todo.id} />
          <input type="hidden" name="done" value={todo.done ? "0" : "1"} />
          <SubmitButton className="btn-primary" pendingText="…">
            {todo.done ? "Not done yet" : "✓ Mark done"}
          </SubmitButton>
        </form>
        <form action={deletePersonal}>
          <input type="hidden" name="item_id" value={todo.id} />
          <SubmitButton className="btn-secondary" confirm="Delete this to-do?" pendingText="…">
            Delete
          </SubmitButton>
        </form>
      </div>
      <TodoForm key={todo.id} todo={todo} ways={personalChannels(user.id)} hasEmail={!!user.email} />
    </>
  );
}
