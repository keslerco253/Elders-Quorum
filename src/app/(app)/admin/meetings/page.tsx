import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { orgMeetings, pendingAgenda, recordsToReview, videoKind, videoLink } from "@/lib/meetings";
import { formatDate, todayIn } from "@/lib/time";
import { leadersWord, roleLabel } from "@/lib/types";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { AgendaList } from "./agenda-list";
import { addAgenda, newMeeting, saveVideoLink, startVideo } from "./actions";

export const metadata = { title: "Presidency meetings" };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const agenda = pendingAgenda(user.org_id);
  const meetings = orgMeetings(user.org_id);
  const review = recordsToReview(user.org_id, today).length;
  const video = videoLink(user.org_id);
  const kind = video ? videoKind(video) : "Zoom";

  return (
    <>
      <PageHeader
        title={`${roleLabel("presidency", user.org)} meetings`}
        back={{ href: "/admin", label: "Admin" }}
        subtitle="The agenda for the next meeting, and each meeting's notes and assignments. Only the presidency can see these."
        actions={
          <Link href="/admin/todos" className="btn-secondary">
            Assignments
          </Link>
        }
      />
      <Flash msg={sp.msg} />
      {review > 0 && (
        <Link href="/admin/meetings/review" className="mb-5 flex items-center justify-between rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          {review} record{review === 1 ? "" : "s"} to review: keep only what&apos;s still needed <span>›</span>
        </Link>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <div id="agenda" className="scroll-mt-20" />
          <Section title={`Agenda for the next meeting${agenda.length ? ` (${agenda.length})` : ""}`}>
            {agenda.length === 0 ? <Empty>Nothing on the agenda yet.</Empty> : <AgendaList items={agenda} tz={tz} canEdit />}
            <form action={addAgenda} className="mt-3 flex gap-2">
              <input name="body" maxLength={2000} required className="input flex-1" placeholder="Add something to discuss…" />
              <SubmitButton className="btn-secondary">Add</SubmitButton>
            </form>
            <p className="hint mt-2">
              Anyone in the presidency can add to it here, or tick &ldquo;Add to the next presidency meeting&rdquo; when sending a message or on a member&apos;s message.
            </p>
          </Section>
          <div className="mt-6">
            <Section title="Meetings">
              {meetings.length === 0 ? (
                <Empty>No meetings yet. Start one when you meet.</Empty>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {meetings.map((m) => (
                    <li key={m.id}>
                      <Link href={`/admin/meetings/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {formatDate(m.date, "short")}
                            {m.title && ` · ${m.title}`}
                          </span>
                          <span className="text-sm text-muted">
                            {[m.attendees, m.item_count && `${m.item_count} agenda item${m.item_count === 1 ? "" : "s"}`, m.todo_count && `${m.todo_count} assignment${m.todo_count === 1 ? "" : "s"}`]
                              .filter(Boolean)
                              .join(" · ") || "No notes yet"}
                          </span>
                        </span>
                        {m.held_at ? m.review_at && m.review_at <= today ? <Badge tone="warn">Review</Badge> : null : <Badge tone="info">In progress</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
        <div className="space-y-5">
        <div id="video" className="card scroll-mt-20 space-y-3">
          <h2 className="h2">{kind === "video" ? "Video meeting" : `${kind} meeting`}</h2>
          {video ? (
            <form action={startVideo} className="space-y-2">
              <SubmitButton pendingText="Opening…">Start {kind} meeting</SubmitButton>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="notify" defaultChecked className="mt-1" />
                <span>Let the rest of the {leadersWord(user.org)} know, with a Join button</span>
              </label>
            </form>
          ) : (
            <p className="text-sm text-muted">
              Save your {leadersWord(user.org)}&apos;s meeting link once (a Zoom personal meeting room or recurring meeting, Google Meet or Teams). Then anyone in the{" "}
              {leadersWord(user.org)} can start it from here.
            </p>
          )}
          <details open={!video}>
            <summary className="cursor-pointer text-sm text-accent">{video ? "Change the link" : "Add the link"}</summary>
            <form action={saveVideoLink} className="mt-2 space-y-2">
              <input name="link" type="url" defaultValue={video ?? ""} className="input" placeholder="https://us02web.zoom.us/j/1234567890?pwd=…" />
              <SubmitButton className="btn-secondary btn-sm">Save link</SubmitButton>
              <p className="hint">In Zoom: Meetings → Personal Room → Copy Invitation, and paste the link (it includes the passcode). Only the {leadersWord(user.org)} sees it. Leave it empty and save to remove it.</p>
            </form>
          </details>
        </div>
        <form action={newMeeting} className="card h-fit space-y-3">
          <h2 className="h2">Start a meeting</h2>
          <input name="date" type="date" required defaultValue={today} className="input" aria-label="Date" />
          <input name="title" maxLength={120} className="input" placeholder="Title (optional)" />
          <SubmitButton>Start</SubmitButton>
          <p className="hint">Opens the agenda and a page for notes with the usual headings. Notes come up for review 3 months after the meeting.</p>
        </form>
        </div>
      </div>
    </>
  );
}
