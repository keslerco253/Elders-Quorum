import Link from "next/link";
import { HandbookLinks } from "@/components/handbook-link";
import { orgChapter } from "@/lib/handbook";
import { requirePresidency } from "@/lib/auth";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { AssignmentForm } from "@/components/assignment-form";
import { deleteTodo, setStatus } from "./actions";
import { orgPresidency, orgRoster } from "@/lib/orgs";
import { roleLabel } from "@/lib/types";
import { dueText, KIND_ICONS, myAssignments, orgTodos, STATUS_LABELS, type Todo } from "@/lib/assignments";

export const metadata = { title: "Assignments" };

const SHOW = { open: "Open", pending: "Not accepted", unassigned: "Unassigned", overdue: "Overdue", done: "Done", all: "All" } as const;
type Show = keyof typeof SHOW;

export default async function TodosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const who = Number(sp.who) || (sp.mine === "1" ? user.id : 0);
  const show: Show = sp.show && sp.show in SHOW ? (sp.show as Show) : "open";
  const all = orgTodos(user.org_id, { assigneeId: who || undefined });
  const overdue = (t: Todo) => !t.done && !!t.due_date && t.due_date < today;
  const todos = all.filter((t) => (show === "open" ? !t.done : show === "pending" ? !t.done && !!t.assignee_id && t.accept_status === "pending" : show === "unassigned" ? !t.done && !t.assignee_id : show === "done" ? !!t.done : show === "overdue" ? overdue(t) : true));
  const presidencyIds = orgPresidency(user.org_id).map((p) => p.id);
  const people = orgRoster(user.org_id, { includeId: who || undefined });
  const editing = sp.edit ? all.find((t) => t.id === Number(sp.edit)) : undefined;
  const person = who ? people.find((p) => p.id === who) : undefined;
  // Everything else this person is doing (teaching, service), to see their whole load.
  const alsoDoing = person ? myAssignments(person.id, today, { orgId: user.org_id }).filter((i) => i.kind !== "todo") : [];
  const query = (o: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    const params: Record<string, string | number | undefined> = { who: who || undefined, show, ...o };
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && !(k === "show" && v === "open")) q.set(k, String(v));
    const s = q.toString();
    return `/admin/todos${s ? `?${s}` : ""}`;
  };
  const back = query({});

  const item = (t: Todo) => (
    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
      <form action={setStatus}>
        <input type="hidden" name="item_id" value={t.id} />
        <input type="hidden" name="status" value={t.done ? "open" : "done"} />
        <input type="hidden" name="back" value={back} />
        <button
          aria-label={t.done ? "Mark not done" : "Mark done"}
          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border-2 ${t.done ? "border-success bg-success text-white" : "border-border hover:border-accent"}`}
        >
          {t.done ? "✓" : ""}
        </button>
      </form>
      <Link href={`/assignments/${t.id}`} className="min-w-0 flex-1">
        <div className={`font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{t.assignee ?? "Unassigned"}</span>
          {!t.done && t.assignee_id && t.accept_status === "pending" && <Badge tone="warn">Not accepted yet</Badge>}
          {t.due_date && (overdue(t) ? <Badge tone="danger">Overdue · {formatDate(t.due_date, "short")}</Badge> : <span>Due {dueText(t.due_date, t.due_time)}</span>)}
          {t.status === "progress" && <Badge tone="info">{STATUS_LABELS.progress}</Badge>}
          {t.note_count > 0 && <span>· {t.note_count} progress note{t.note_count === 1 ? "" : "s"}</span>}
          {t.meeting_date && <span>· from the {formatDate(t.meeting_date, "short")} meeting</span>}
        </div>
        {t.notes && <p className="mt-1 line-clamp-2 text-sm whitespace-pre-wrap text-muted">{t.notes}</p>}
      </Link>
      <div className="flex gap-1">
        <Link href={query({ edit: t.id })} className="btn-secondary btn-sm">
          Edit
        </Link>
        <form action={deleteTodo}>
          <input type="hidden" name="item_id" value={t.id} />
          <input type="hidden" name="back" value={back} />
          <SubmitButton className="btn-secondary btn-sm" confirm="Delete this assignment?" pendingText="…">
            ✕
          </SubmitButton>
        </form>
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        title={`${roleLabel("presidency", user.org)} assignments`}
        back={{ href: "/admin", label: "Admin" }}
        subtitle="To anyone in the organization. Tap one to see its progress notes."
        actions={
          <Link href="/admin/meetings" className="btn-secondary">
            Meetings
          </Link>
        }
      />
      <Flash msg={sp.msg} />
      <HandbookLinks chapters={[orgChapter(user.org)]} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <form className="mb-3 flex flex-wrap items-center gap-2">
            <select name="who" defaultValue={who || ""} className="input w-auto" aria-label="Person">
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === user.id ? `${p.display_name} (me)` : p.display_name}
                </option>
              ))}
            </select>
            {show !== "open" && <input type="hidden" name="show" value={show} />}
            <button className="btn-secondary btn-sm">Show</button>
          </form>
          <div className="mb-4 flex flex-wrap gap-1">
            {(Object.keys(SHOW) as Show[]).map((s) => (
              <Link key={s} href={query({ show: s })} className={`rounded-full px-3 py-1 text-sm font-medium ${show === s ? "bg-primary text-primary-text" : "bg-surface-2 text-muted hover:text-text"}`}>
                {SHOW[s]}
                {s === "overdue" && all.some(overdue) ? ` (${all.filter(overdue).length})` : ""}
              </Link>
            ))}
          </div>
          {todos.length === 0 ? (
            <Empty>{show === "open" ? "Nothing open. 🎉" : "None here."}</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">{todos.slice(0, 100).map(item)}</ul>
          )}
          {person && (
            <div className="mt-6">
              <Section title={`Also on ${person.display_name}'s plate`}>
                {alsoDoing.length === 0 ? (
                  <p className="text-sm text-muted">No teaching or service coming up.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                    {alsoDoing.map((i) => (
                      <li key={i.key}>
                        <Link href={i.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                          <span aria-hidden>{KIND_ICONS[i.kind]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{i.title}</span>
                            <span className="text-xs text-muted">{i.detail}</span>
                          </span>
                          {i.flag && <Badge tone={i.flag.tone}>{i.flag.text}</Badge>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}
        </div>
        <div>
          <AssignmentForm key={editing?.id ?? "new"} todo={editing} people={people} presidencyIds={presidencyIds} back={back} defaultAssignee={editing ? undefined : who || user.id} cancelHref={back} />
        </div>
      </div>
    </>
  );
}
