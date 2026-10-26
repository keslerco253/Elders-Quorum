import Link from "next/link";
import { DateTime } from "luxon";
import { requirePresidency } from "@/lib/auth";
import { attendeeChoices, MEETING_ROLES, meetingRolesText, orgMeetings, pendingAgenda, recordsToReview, videoKind, videoLink } from "@/lib/meetings";
import { formatDate, todayIn } from "@/lib/time";
import { leadersWord, roleLabel } from "@/lib/types";
import { MEETING_MINUTES, reminderSettings } from "@/lib/reminder-settings";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { AgendaList } from "./agenda-list";
import { HandbookLink } from "@/components/handbook-link";
import { orgChapter } from "@/lib/handbook";
import { addAgenda, newMeeting, saveMeetingRole, saveVideoLink, startVideo } from "./actions";
import { RoleSelect } from "./role-select";

export const metadata = { title: "Presidency meetings" };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const agenda = pendingAgenda(user.org_id);
  // The handbook chapter for this organization's leaders (presidency meetings are in it).
  const chapter = orgChapter(user.org);
  const meetings = orgMeetings(user.org_id);
  const review = recordsToReview(user.org_id, today).length;
  const video = videoLink(user.org_id);
  const reminderMin = reminderSettings(user.org_id).meetingMinutes;
  const reminderText = reminderMin ? `with a reminder ${MEETING_MINUTES.find(([m]) => m === reminderMin)?.[1]}` : "with no reminder";
  // Scheduled and not finished yet (today's too); the rest are past.
  const upcoming = meetings.filter((m) => !m.held_at && m.date >= today).reverse();
  const past = meetings.filter((m) => !upcoming.includes(m));
  // The opening prayer, thought and closing prayer are chosen for the next meeting.
  const next = upcoming.find((m) => m.kind === "presidency");
  const names = attendeeChoices(user.org_id)
    .filter((p) => p.id > 0)
    .map((p) => p.name);
  const roleSelect = (role: (typeof MEETING_ROLES)[number]) =>
    next && <RoleSelect key={role[0]} action={saveMeetingRole} meetingId={next.id} role={role[0]} label={role[1]} value={next[role[0]]} names={names} back="list" />;
  // A new meeting starts at the time of the last one.
  const lastTime = meetings.find((m) => m.time)?.time ?? "";
  const timeText = (t: string | null) => (t ? DateTime.fromFormat(t, "HH:mm").toFormat("h:mm a") : "");
  const list = (rows: typeof meetings) => (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map((m) => (
        <li key={m.id}>
          <Link href={`/admin/meetings/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="min-w-0">
              <span className="block font-medium">
                {formatDate(m.date, "short")}
                {m.time && ` · ${timeText(m.time)}`}
                {m.title && ` · ${m.title}`}
              </span>
              <span className="text-sm text-muted">
                {[
                  m.kind === "invited" && `${m.invited_count} invited${m.invited_count && !m.held_at ? `, ${m.coming_count} coming` : ""}`,
                  m.attendees,
                  meetingRolesText(m),
                  m.item_count && `${m.item_count} agenda item${m.item_count === 1 ? "" : "s"}`, m.todo_count && `${m.todo_count} assignment${m.todo_count === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(" · ") || (m.held_at ? "No notes" : "Tap to open the agenda")}
              </span>
            </span>
            {m.held_at ? (
              m.review_at && m.review_at <= today ? <Badge tone="warn">Review</Badge> : null
            ) : m.date === today ? (
              <Badge tone="info">Today</Badge>
            ) : m.date > today ? (
              <Badge tone="neutral">Scheduled</Badge>
            ) : (
              <Badge tone="warn">Not finished</Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
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
      {chapter && <HandbookLink chapter={chapter} className="mb-4" />}
      {review > 0 && (
        <Link href="/admin/meetings/review" className="mb-5 flex items-center justify-between rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          {review} record{review === 1 ? "" : "s"} to review: keep only what&apos;s still needed <span>›</span>
        </Link>
      )}
      <form action={newMeeting} className="card mb-6 space-y-3">
        <h2 className="h2">Schedule a meeting</h2>
        <select name="kind" className="input" aria-label="Which meeting" defaultValue="presidency">
          <option value="presidency">{roleLabel("presidency", user.org)} meeting</option>
          <option value="invited">Another meeting: invite people to it</option>
        </select>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_2fr]">
          <input name="date" type="date" required defaultValue={today} min={today} className="input" aria-label="Date" />
          <input name="time" type="time" required defaultValue={lastTime} className="input" aria-label="Time" />
          <input name="title" maxLength={120} className="input col-span-2 sm:col-span-1" placeholder="Title (needed for another meeting)" />
          <input name="location" maxLength={200} className="input col-span-2 sm:col-span-2" placeholder="Where (optional)" />
          <SubmitButton className="btn-primary col-span-2 sm:col-span-1">Schedule</SubmitButton>
        </div>
        <p className="hint">
          A {leadersWord(user.org)} meeting goes on the {leadersWord(user.org)}&apos;s calendar and their Coming up list on Home, {reminderText} (change it under Settings → Reminder times). Only the{" "}
          {leadersWord(user.org)} sees it. Another meeting (an activities committee, a teachers&apos; council…) opens next so you can invite people by calling or by name: they&apos;re
          notified, can say whether they&apos;ll come, and see it on their calendar and Home.
        </p>
      </form>
      {upcoming.length > 0 && (
        <div className="mb-6">
          <Section title="Coming up">{list(upcoming)}</Section>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div>
          <div id="agenda" className="scroll-mt-20" />
          <Section
            title={`Agenda for the next meeting${agenda.length ? ` (${agenda.length})` : ""}`}
            actions={
              next && (
                <Link href={`/admin/meetings/${next.id}`} className="btn-primary btn-sm">
                  Open meeting ›
                </Link>
              )
            }
          >
            {next ? (
              <div className="mb-3 space-y-2">
                <p className="text-xs text-muted">
                  {formatDate(next.date, "short")}
                  {next.time && ` · ${timeText(next.time)}`}
                </p>
                {MEETING_ROLES.slice(0, 2).map(roleSelect)}
              </div>
            ) : (
              <p className="hint mb-3">Schedule the next meeting to choose who gives the prayers and the spiritual thought.</p>
            )}
            {agenda.length === 0 ? <Empty>Nothing on the agenda yet.</Empty> : <AgendaList items={agenda} tz={tz} canEdit />}
            {next && <div className="mt-3">{roleSelect(MEETING_ROLES[2])}</div>}
            <form action={addAgenda} className="mt-3 flex gap-2">
              <input name="body" maxLength={2000} required className="input flex-1" placeholder="Add something to discuss…" />
              <SubmitButton className="btn-secondary">Add</SubmitButton>
            </form>
            <p className="hint mt-2">
              Tap an item to change it or add notes before the meeting. Use ⤒ (to the top) and ↑ / ↓ to put it in order. Anyone in the presidency can add to it here, or tick &ldquo;Add to the next presidency meeting&rdquo; when sending a message or on a member&apos;s message. In
              the meeting, open it and tap an item to take notes on it.
            </p>
          </Section>
          <div className="mt-6">
            <Section title="Past meetings">{past.length === 0 ? <Empty>No meetings yet.</Empty> : list(past)}</Section>
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
        </div>
      </div>
    </>
  );
}
