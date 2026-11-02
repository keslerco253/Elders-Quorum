import Link from "next/link";
import { assignmentReview, STATUS_LABELS, type Todo } from "@/lib/assignments";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge } from "@/components/ui";

/**
 * The bottom of a presidency meeting's agenda: assignments completed since the last
 * meeting, and all those still open, to review (and change if needed) each time.
 */
export function AssignmentReview({ orgId, meetingId, today, tz }: { orgId: number; meetingId?: number; today: string; tz: string }) {
  const { since, completed, open } = assignmentReview(orgId, meetingId);
  const row = (t: Todo) => (
    <li key={t.id}>
      <Link href={`/assignments/${t.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 hover:bg-surface-2">
        <span className={`mr-auto text-sm font-medium ${t.done ? "text-muted" : ""}`}>
          {t.done ? "✓ " : ""}
          {t.title}
        </span>
        <span className="text-xs text-muted">
          {t.assignee ?? "Unassigned"}
          {t.done ? (t.done_at ? ` · done ${formatDateTime(t.done_at, tz, "LLL d")}` : "") : t.due_date ? ` · due ${formatDate(t.due_date, "short")}` : ""}
        </span>
        {!t.done &&
          (t.due_date && t.due_date < today ? (
            <Badge tone="danger">Overdue</Badge>
          ) : t.assignee_id && t.accept_status === "pending" ? (
            <Badge tone="warn">Not accepted yet</Badge>
          ) : !t.assignee_id ? (
            <Badge tone="warn">Unassigned</Badge>
          ) : t.status !== "open" ? (
            <Badge tone="info">{STATUS_LABELS[t.status]}</Badge>
          ) : null)}
      </Link>
    </li>
  );
  return (
    <div id="assignment-review" className="scroll-mt-20 space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-accent">Assignment review</h4>
        <Link href="/admin/todos" className="text-xs link">
          All assignments ›
        </Link>
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">
          Completed {since ? `since the last meeting (${formatDateTime(since, tz, "LLL d")})` : "in the last 30 days"}
          {completed.length ? ` (${completed.length})` : ""}
        </div>
        {completed.length ? <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{completed.map(row)}</ul> : <p className="text-sm text-muted">None.</p>}
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">Still open{open.length ? ` (${open.length})` : ""}</div>
        {open.length ? <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{open.map(row)}</ul> : <p className="text-sm text-muted">None. Everything is done.</p>}
      </div>
      <p className="hint">Tap one to change it (who has it, its due date) or add a note.</p>
    </div>
  );
}
