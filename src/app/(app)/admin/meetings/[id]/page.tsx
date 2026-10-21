import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { getMeeting, meetingAgenda, pendingAgenda, videoKind, videoLink } from "@/lib/meetings";
import { orgTodos, STATUS_LABELS } from "@/lib/assignments";
import { orgPresidency, orgRoster } from "@/lib/orgs";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { AssignmentForm } from "@/components/assignment-form";
import { AgendaList } from "../agenda-list";
import { addAgenda, deleteMeeting, finish, saveMeeting, startVideo } from "../actions";

export const metadata = { title: "Presidency meeting" };

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const m = getMeeting(user.org_id, Number((await params).id));
  if (!m) notFound();
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const held = !!m.held_at;
  // Before it's finished the meeting works from the waiting agenda; after, from what was filed with it.
  const filed = meetingAgenda(m.id);
  const waiting = held ? [] : pendingAgenda(user.org_id);
  const presidency = orgPresidency(user.org_id);
  const attending = m.attendees.split(",").map((s) => s.trim()).filter(Boolean);
  const others = attending.filter((n) => !presidency.some((p) => p.display_name === n));
  const todos = orgTodos(user.org_id, { meetingId: m.id });
  const from = sp.assign ? [...waiting, ...filed].find((a) => a.id === Number(sp.assign)) : undefined;
  const back = `/admin/meetings/${m.id}`;
  const video = held ? null : videoLink(user.org_id);

  return (
    <>
      <PageHeader
        title={`${m.title || "Presidency meeting"} · ${formatDate(m.date, "short")}`}
        back={{ href: "/admin/meetings", label: "Meetings" }}
        subtitle={held ? `Finished. ${m.review_at ? `Up for review ${formatDate(m.review_at, "short")}.` : ""}` : "In progress: tick agenda items as you discuss them, then finish the meeting."}
      />
      <Flash msg={sp.msg} />
      {video && (
        <form action={startVideo} className="mb-5 flex flex-wrap items-center gap-3">
          <SubmitButton className="btn-secondary" pendingText="Opening…">
            Start {videoKind(video)} meeting
          </SubmitButton>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify" defaultChecked /> Let the others know
          </label>
        </form>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div id="agenda" className="scroll-mt-20" />
          <Section title="Agenda">
            {waiting.length + filed.length === 0 ? (
              <Empty>Nothing on the agenda.</Empty>
            ) : (
              <div className="space-y-3">
                {filed.length > 0 && <AgendaList items={filed} tz={tz} meetingId={m.id} canEdit={false} />}
                {waiting.length > 0 && <AgendaList items={waiting} tz={tz} meetingId={m.id} canEdit />}
              </div>
            )}
            {!held && (
              <>
                <form action={addAgenda} className="mt-3 flex gap-2">
                  <input type="hidden" name="meeting_id" value={m.id} />
                  <input name="body" maxLength={2000} required className="input flex-1" placeholder="Add something to discuss…" />
                  <SubmitButton className="btn-secondary">Add</SubmitButton>
                </form>
                <form action={finish} className="mt-4">
                  <input type="hidden" name="meeting_id" value={m.id} />
                  <SubmitButton className="btn-primary" confirm="Finish the meeting? Ticked items are filed with it; the rest wait for the next meeting." pendingText="Finishing…">
                    Finish meeting
                  </SubmitButton>
                  <p className="hint mt-1">Ticked items are filed with this meeting. Anything not ticked stays on the agenda for next time.</p>
                </form>
              </>
            )}
          </Section>

          <form action={saveMeeting} className="card space-y-3">
            <input type="hidden" name="meeting_id" value={m.id} />
            <h2 className="h2">Notes</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="date" type="date" required defaultValue={m.date} className="input" aria-label="Date" />
              <input name="title" maxLength={120} defaultValue={m.title} className="input" placeholder="Title (optional)" />
            </div>
            <fieldset>
              <legend className="label">Who was there</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {presidency.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="att" value={p.display_name} defaultChecked={attending.includes(p.display_name)} /> {p.display_name}
                  </label>
                ))}
              </div>
              <input name="att_other" defaultValue={others.join(", ")} className="input mt-2" placeholder="Others (names, separated by commas)" />
            </fieldset>
            <textarea name="notes" rows={16} defaultValue={m.notes} className="input font-mono text-sm" aria-label="Notes" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="hint">Lines starting with ## are headings. Keep notes brief, and only what&apos;s needed.</span>
              <SubmitButton pendingText="Saving…">Save notes</SubmitButton>
            </div>
          </form>

          <form action={deleteMeeting}>
            <input type="hidden" name="meeting_id" value={m.id} />
            <SubmitButton className="btn-secondary btn-sm" confirm="Delete this meeting, its notes and its filed agenda? Assignments stay." pendingText="Deleting…">
              Delete meeting
            </SubmitButton>
          </form>
        </div>

        <div className="space-y-4">
          <Section title="Assignments from this meeting">
            {todos.length === 0 ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {todos.map((t) => (
                  <li key={t.id}>
                    <Link href={`/assignments/${t.id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                      <span className={`block text-sm font-medium ${t.done ? "text-muted line-through" : ""}`}>{t.title}</span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {t.assignee ?? "Unassigned"}
                        {t.due_date && ` · due ${formatDate(t.due_date, "short")}`}
                        {!t.done && t.due_date && t.due_date < today ? <Badge tone="danger">Overdue</Badge> : t.status !== "open" && <Badge tone={t.done ? "success" : "info"}>{STATUS_LABELS[t.status]}</Badge>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <AssignmentForm
            key={from?.id ?? "new"}
            people={orgRoster(user.org_id)}
            presidencyIds={presidency.map((p) => p.id)}
            back={back}
            meetingId={m.id}
            defaultTitle={from ? (from.body.length > 200 ? `${from.body.slice(0, 197)}…` : from.body) : undefined}
            defaultAssignee={user.id}
            cancelHref={from ? back : undefined}
          />
        </div>
      </div>
    </>
  );
}
