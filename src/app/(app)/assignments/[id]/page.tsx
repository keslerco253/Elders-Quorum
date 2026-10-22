import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dueText, getTodo, isPresidencyOf, STATUS_LABELS, todoNotes } from "@/lib/assignments";
import { withOrg } from "@/lib/org-cookie";
import { formatDate, formatDateTime, todayIn } from "@/lib/time";
import { Linkify } from "@/components/linkify";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { acceptAssignmentRequest, addProgress, answerAssignmentAsk, askToTakeAssignment, declineAssignmentRequest, unableToDoAssignment, withdrawAssignmentAsk } from "../actions";
import { FlyerView } from "@/components/flyer-view";
import { canAnswer, pendingHandoff } from "@/lib/assignment-handoffs";
import { orgPresidency, orgRoster } from "@/lib/orgs";
import { deleteTodo } from "../../admin/todos/actions";

export const metadata = { title: "Assignment" };

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = getTodo(Number((await params).id));
  const leader = !!t && isPresidencyOf(user.id, t.org_id);
  // An unanswered "can you take this?" (to them, or to the whole presidency).
  const ask = t ? pendingHandoff(t.id) : undefined;
  const askedMe = !!ask && !!t && canAnswer(ask, t, user.id);
  if (!t || (!leader && t.assignee_id !== user.id && !askedMe)) notFound();
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const mine = t.assignee_id === user.id;
  const notes = todoNotes(t.id, leader);
  const overdue = !t.done && !!t.due_date && t.due_date < today;
  const presidencyIds = leader ? orgPresidency(t.org_id).map((p) => p.id) : [];
  const people = leader ? orgRoster(t.org_id).filter((p) => p.id !== user.id && p.id !== t.assignee_id) : [];
  const presidency = people.filter((p) => presidencyIds.includes(p.id));
  const others = people.filter((p) => !presidencyIds.includes(p.id));
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
      <Flash msg={sp.error} tone="danger" />
      <div className="card mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={tone}>{STATUS_LABELS[t.status]}</Badge>
          {!t.done && t.assignee_id && t.accept_status === "pending" && <Badge tone="warn">Not accepted yet</Badge>}
          {t.due_date && (overdue ? <Badge tone="danger">Overdue · was due {formatDate(t.due_date, "short")}</Badge> : <span className="text-muted">Due {dueText(t.due_date, t.due_time)}</span>)}
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

      {t.flyer_file && <FlyerView file={t.flyer_file} name={t.flyer_name} className="card mb-5" />}

      {/* A request waiting for their answer. */}
      {mine && !t.done && t.accept_status === "pending" && (
        <div className="card mb-5 space-y-3 border-accent/40 bg-accent-soft">
          <div className="text-sm">
            <span className="block font-semibold">Would you be willing to accept this assignment?</span>
            <span className="text-muted">{t.creator ?? "Your presidency"} asked you. Read the details above, then let them know.</span>
          </div>
          <form action={acceptAssignmentRequest}>
            <input type="hidden" name="item_id" value={t.id} />
            <SubmitButton pendingText="Accepting…">Yes, I accept</SubmitButton>
          </form>
          <details>
            <summary className="cursor-pointer text-sm font-medium">I&apos;m not able to</summary>
            <form action={declineAssignmentRequest} className="mt-2 space-y-2">
              <input type="hidden" name="item_id" value={t.id} />
              <textarea name="note" rows={2} maxLength={1000} className="input" placeholder="A note for the presidency (optional)" />
              <SubmitButton className="btn-secondary" pendingText="Sending…">
                Let them know I can&apos;t
              </SubmitButton>
            </form>
          </details>
        </div>
      )}

      {ask && (askedMe || leader) && (
        <div className="card mb-5 space-y-3 border-accent/40 bg-accent-soft">
          <div className="text-sm">
            <span className="font-semibold">
              {askedMe ? "Can you take this assignment?" : `Waiting on ${ask.to_name ?? "the presidency"} to take it`}
            </span>
            <span className="block text-muted">
              {ask.from_id === user.id ? "You" : (ask.from_name ?? "Someone")} asked {ask.to_id ? (ask.to_id === user.id ? "you" : ask.to_name) : "the presidency"}
              {ask.to_id ? "" : " (whoever says yes first takes it)"}.
              {ask.note && <> &ldquo;{ask.note}&rdquo;</>}
            </span>
          </div>
          {askedMe && (
            <form action={answerAssignmentAsk} className="flex flex-wrap gap-2">
              <input type="hidden" name="handoff_id" value={ask.id} />
              <SubmitButton name="answer" value="yes">
                Yes, I&apos;ll take it
              </SubmitButton>
              <SubmitButton name="answer" value="no" className="btn-secondary">
                I can&apos;t
              </SubmitButton>
            </form>
          )}
          {ask.from_id === user.id && (
            <form action={withdrawAssignmentAsk}>
              <input type="hidden" name="handoff_id" value={ask.id} />
              <SubmitButton className="btn-secondary btn-sm">Withdraw the request</SubmitButton>
            </form>
          )}
        </div>
      )}

      {leader && !t.done && !ask && (
        <details className="card mb-5">
          <summary className="cursor-pointer font-medium">Ask someone else to take it</summary>
          <form action={askToTakeAssignment} className="mt-3 space-y-3">
            <input type="hidden" name="item_id" value={t.id} />
            <select name="to" className="input" defaultValue="presidency" aria-label="Who to ask">
              <option value="presidency">The whole presidency (first to say yes takes it)</option>
              <optgroup label="Presidency">
                {presidency.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </optgroup>
              {others.length > 0 && (
                <optgroup label="Members">
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <textarea name="note" rows={2} maxLength={500} className="input" placeholder="A note (optional): why, or anything they should know" />
            <SubmitButton>Send request</SubmitButton>
            <p className="hint">They get a notification and can say yes or no. If they say yes, the assignment becomes theirs and the presidency is told.</p>
          </form>
        </details>
      )}

      {mine && !t.done && t.accept_status !== "pending" && (
        <details className="card mb-5">
          <summary className="cursor-pointer font-medium">I&apos;m unable to do this assignment</summary>
          <form action={unableToDoAssignment} className="mt-3 space-y-3">
            <input type="hidden" name="item_id" value={t.id} />
            <textarea name="note" rows={3} maxLength={1000} className="input" placeholder="A note for the presidency (optional): what's changed, or anything they should know" />
            <SubmitButton className="btn-secondary" confirm="Let the presidency know you can't do this?" pendingText="Sending…">
              I&apos;m unable to do this
            </SubmitButton>
            <p className="hint">The presidency is notified (with your note), and they&apos;ll find someone else. It comes off your list.</p>
          </form>
        </details>
      )}

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
