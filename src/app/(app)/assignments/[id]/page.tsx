import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTodo, isPresidencyOf, STATUS_LABELS, todoNotes } from "@/lib/assignments";
import { withOrg } from "@/lib/org-cookie";
import { formatDate, formatDateTime, todayIn } from "@/lib/time";
import { Linkify } from "@/components/linkify";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { addProgress } from "../actions";
import { deleteTodo } from "../../admin/todos/actions";

export const metadata = { title: "Assignment" };

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = getTodo(Number((await params).id));
  const leader = !!t && isPresidencyOf(user.id, t.org_id);
  if (!t || (!leader && t.assignee_id !== user.id)) notFound();
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const mine = t.assignee_id === user.id;
  const notes = todoNotes(t.id, leader);
  const overdue = !t.done && !!t.due_date && t.due_date < today;
  const tone = t.done ? "success" : t.status === "progress" ? "info" : "neutral";

  return (
    <>
      <PageHeader
        title={t.title}
        back={leader ? { href: withOrg("/admin/todos", t.org_id), label: "Assignments" } : { href: "/assignments", label: "My assignments" }}
        actions={
          leader && (
            <div className="flex gap-2">
              <Link href={withOrg(`/admin/todos?edit=${t.id}`, t.org_id)} className="btn-secondary">
                Edit
              </Link>
              <form action={deleteTodo}>
                <input type="hidden" name="item_id" value={t.id} />
                <input type="hidden" name="back" value={withOrg("/admin/todos", t.org_id)} />
                <SubmitButton className="btn-secondary text-danger" confirm="Delete this assignment and its progress notes?" pendingText="Deleting…">
                  Delete
                </SubmitButton>
              </form>
            </div>
          )
        }
      />
      <Flash msg={sp.msg} tone="success" />
      <div className="card mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={tone}>{STATUS_LABELS[t.status]}</Badge>
          {t.due_date && (overdue ? <Badge tone="danger">Overdue · was due {formatDate(t.due_date, "short")}</Badge> : <span className="text-muted">Due {formatDate(t.due_date)}</span>)}
        </div>
        <div className="text-sm text-muted">
          {mine ? "Assigned to you" : `Assigned to ${t.assignee ?? "no one yet"}`}
          {t.creator && ` by ${t.creator}`} · {formatDate(t.created_at.slice(0, 10), "short")}
          {leader && t.meeting_id && t.meeting_date && (
            <>
              {" "}
              · from the{" "}
              <Link href={withOrg(`/admin/meetings/${t.meeting_id}`, t.org_id)} className="link">
                {formatDate(t.meeting_date, "short")} meeting
              </Link>
            </>
          )}
        </div>
        {t.notes && (
          <p className="pt-1 whitespace-pre-wrap break-words">
            <Linkify text={t.notes} />
          </p>
        )}
      </div>

      <h2 className="h2 mb-2">Progress</h2>
      {notes.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No progress notes yet.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-xl border px-3 py-2 text-sm ${n.private ? "border-warn/40 bg-warn-soft" : "border-border bg-surface"}`}>
              <div className="whitespace-pre-wrap break-words">
                <Linkify text={n.body} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                {n.author ?? "Someone"} · {formatDateTime(n.created_at, tz, "LLL d, h:mm a")}
                {!!n.private && <Badge tone="warn">Presidency only</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div id="end" className="scroll-mt-20" />
      <form action={addProgress} className="card space-y-3">
        <input type="hidden" name="item_id" value={t.id} />
        <label className="label" htmlFor="progress-body">
          Add a progress note
        </label>
        <textarea id="progress-body" name="body" rows={3} maxLength={2000} className="input" placeholder={mine ? "How is it going? What's done, what's next…" : "A note on this assignment…"} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm" htmlFor="progress-status">
            Status
          </label>
          <select id="progress-status" name="status" defaultValue="" className="input w-auto">
            <option value="">Keep: {STATUS_LABELS[t.status]}</option>
            {(["open", "progress", "done"] as const)
              .filter((s) => s !== t.status)
              .map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
          </select>
        </div>
        {leader && !mine && t.assignee_id && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="private" className="mt-1" />
            <span>
              Presidency only: {t.assignee ?? "the person assigned"} won&apos;t see this note
            </span>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            {leader
              ? mine
                ? "The rest of the presidency hears when it's done."
                : `${t.assignee ?? "The person assigned"} gets a notification with your note (unless it's presidency only).`
              : "The presidency gets a notification with your note."}
          </span>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </div>
      </form>
    </>
  );
}
