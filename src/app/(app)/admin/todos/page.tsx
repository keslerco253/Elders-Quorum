import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { deleteTodo, saveTodo, toggleTodo } from "./actions";

export const metadata = { title: "Presidency assignments" };

interface Todo {
  id: number;
  title: string;
  notes: string;
  due_date: string | null;
  assignee_id: number | null;
  assignee: string | null;
  done: number;
}

export default async function TodosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const mineOnly = sp.mine === "1";
  const todos = db()
    .prepare(
      `SELECT t.*, m.display_name AS assignee FROM todos t LEFT JOIN members m ON m.id = t.assignee_id
       WHERE t.ward_id = ? ${mineOnly ? "AND t.assignee_id = ?" : ""}
       ORDER BY t.done, t.due_date IS NULL, t.due_date, t.id DESC LIMIT 200`,
    )
    .all(...(mineOnly ? [user.ward_id, user.id] : [user.ward_id])) as Todo[];
  const people = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND role = 'presidency' AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const editing = sp.edit ? todos.find((t) => t.id === Number(sp.edit)) : undefined;

  const form = (t?: Todo) => (
    <form action={saveTodo} className="card space-y-3">
      {t && <input type="hidden" name="id" value={t.id} />}
      <h2 className="h2">{t ? "Edit assignment" : "New assignment"}</h2>
      <input name="title" required maxLength={200} className="input" placeholder="What needs to be done?" defaultValue={t?.title} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="assignee_id" className="input" defaultValue={t?.assignee_id ?? user.id}>
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <input name="due_date" type="date" className="input" defaultValue={t?.due_date ?? ""} aria-label="Due date" />
      </div>
      <textarea name="notes" rows={2} className="input" placeholder="Notes (optional)" defaultValue={t?.notes} />
      <div className="flex gap-2">
        <SubmitButton>{t ? "Save" : "Add"}</SubmitButton>
        {t && (
          <a href="/admin/todos" className="btn-secondary">
            Cancel
          </a>
        )}
      </div>
      <p className="hint">The person assigned gets a notification and reminders the day before and the day it&apos;s due.</p>
    </form>
  );

  const item = (t: Todo) => {
    const overdue = !t.done && t.due_date && t.due_date < today;
    return (
      <li key={t.id} className="flex items-start gap-3 px-4 py-3">
        <form action={toggleTodo}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="done" value={t.done ? "0" : "1"} />
          <button aria-label={t.done ? "Mark not done" : "Mark done"} className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border-2 ${t.done ? "border-success bg-success text-white" : "border-border hover:border-accent"}`}>
            {t.done ? "✓" : ""}
          </button>
        </form>
        <div className="min-w-0 flex-1">
          <div className={`font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{t.assignee ?? "Unassigned"}</span>
            {t.due_date && (overdue ? <Badge tone="danger">Overdue · {formatDate(t.due_date, "short")}</Badge> : <span>Due {formatDate(t.due_date, "short")}</span>)}
          </div>
          {t.notes && <p className="mt-1 text-sm whitespace-pre-wrap text-muted">{t.notes}</p>}
        </div>
        <div className="flex gap-1">
          <a href={`/admin/todos?edit=${t.id}`} className="btn-secondary btn-sm">
            Edit
          </a>
          <form action={deleteTodo}>
            <input type="hidden" name="id" value={t.id} />
            <SubmitButton className="btn-secondary btn-sm" confirm="Delete this assignment?" pendingText="…">
              ✕
            </SubmitButton>
          </form>
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Presidency assignments"
        back={{ href: "/admin", label: "Admin" }}
        actions={
          <a href={mineOnly ? "/admin/todos" : "/admin/todos?mine=1"} className="btn-secondary">
            {mineOnly ? "Show everyone's" : "Only mine"}
          </a>
        }
      />
      <Flash msg={sp.msg} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          {open.length === 0 ? <Empty>Nothing open. 🎉</Empty> : <ul className="divide-y divide-border rounded-xl border border-border bg-surface">{open.map(item)}</ul>}
          {done.length > 0 && (
            <div className="mt-6">
            <Section title={`Done (${done.length})`}>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">{done.slice(0, 30).map(item)}</ul>
            </Section>
            </div>
          )}
        </div>
        <div>{form(editing)}</div>
      </div>
    </>
  );
}
