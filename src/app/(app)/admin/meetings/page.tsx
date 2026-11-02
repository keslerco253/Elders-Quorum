import { Labeled } from "@/components/labeled";
import Link from "next/link";
import { DateTime } from "luxon";
import { requirePresidency } from "@/lib/auth";
import { attendeeChoices, MEETING_ROLES, meetingReminders, meetingRolesText, orgMeetings, pendingAgenda, recordsToReview, videoKind, videoLink } from "@/lib/meetings";
import { formatDate, todayIn } from "@/lib/time";
import { leadersWord, roleLabel } from "@/lib/types";
import { reminderSettings } from "@/lib/reminder-settings";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { AgendaList } from "./agenda-list";
import { HandbookLinks } from "@/components/handbook-link";
import { MEETINGS, orgChapter } from "@/lib/handbook";
import { addAgenda, newMeeting, saveMeetingRole, saveMeetingWhen, saveVideoLink, startVideo } from "./actions";
import { RoleSelect } from "./role-select";
import { PrintAgendaButton, PrintPastNotes } from "./print-agenda";
import { NOTES_RANGES } from "@/lib/agenda-print";
import { MeetingReminderFields } from "./reminder-fields";
import { SectionSelect } from "./section-select";
import { MeetingDateInput } from "./meeting-date";
import { RepeatFields } from "@/components/repeat-fields";

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
  // Scheduled and not finished yet (today's too); the rest are past.
  const upcoming = meetings.filter((m) => !m.held_at && m.date >= today).reverse();
  const past = meetings.filter((m) => !upcoming.includes(m));
  // The opening prayer, thought and closing prayer are chosen for the next meeting.
  const next = upcoming.find((m) => m.kind === "presidency");
  // Other scheduled meetings (the next one is at the top).
  const later = upcoming.filter((m) => m !== next);
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

  const editing = sp.edit === "1";
  const longDate = (d: string) => DateTime.fromISO(d).toFormat("cccc, LLLL d");

  return (
    <>
      <PageHeader
        title={`${roleLabel("presidency", user.org)} meetings`}
        back={{ href: "/admin", label: "Admin" }}
        subtitle="The next meeting and its agenda, and each meeting's notes and assignments. Only the presidency can see these."
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

      {/* The next meeting: when and where, who prays, and its agenda. Edit meeting puts the agenda in order. */}
      <section id="next" className="card mb-6 scroll-mt-20 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">Next meeting</div>
            {next ? (
              <>
                <h2 className="h1 mt-1">
                  {longDate(next.date)}
                  {next.time && <span className="text-muted"> · {timeText(next.time)}</span>}
                </h2>
                {(next.title || next.location) && <p className="mt-0.5 text-sm text-muted">{[next.title, next.location].filter(Boolean).join(" · ")}</p>}
              </>
            ) : (
              <h2 className="h2 mt-1">No meeting scheduled yet</h2>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {next?.date === today && <Badge tone="info">Today</Badge>}
            {editing ? (
              <Link href="/admin/meetings#next" className="btn-primary btn-sm">
                ✓ Done editing
              </Link>
            ) : (
              <Link href="/admin/meetings?edit=1#next" className="btn-secondary btn-sm">
                ✏️ {next ? "Edit meeting" : "Edit agenda"}
              </Link>
            )}
            {next && <PrintAgendaButton meetingId={next.id} />}
            {next && (
              <Link href={`/admin/meetings/${next.id}`} className="btn-primary btn-sm">
                Open meeting ›
              </Link>
            )}
          </div>
        </div>

        {next && editing && (
          <form action={saveMeetingWhen} className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-3">
            <input type="hidden" name="meeting_id" value={next.id} />
            <Labeled label="Date">
              <input name="date" type="date" required defaultValue={next.date} className="input" />
            </Labeled>
            <Labeled label="Time">
              <input name="time" type="time" required defaultValue={next.time ?? ""} className="input" />
            </Labeled>
            <Labeled label="Title" hint="optional" className="col-span-2 sm:col-span-1">
              <input name="title" maxLength={120} defaultValue={next.title} className="input" />
            </Labeled>
            <Labeled label="Where" hint="optional" className="col-span-2 sm:col-span-1">
              <input name="location" maxLength={200} defaultValue={next.location} className="input" />
            </Labeled>
            <MeetingReminderFields
              id="edit"
              first={meetingReminders(user.org_id, next)[0] ?? 0}
              second={meetingReminders(user.org_id, next)[1] ?? 0}
              className="col-span-2"
            />
            <SubmitButton className="btn-secondary col-span-2 sm:col-span-1 sm:w-auto" pendingText="Saving…">
              Save
            </SubmitButton>
          </form>
        )}

        {next &&
          (editing ? (
            <div className="space-y-2">{MEETING_ROLES.map(roleSelect)}</div>
          ) : (
            <p className="text-sm">
              {MEETING_ROLES.map(([k, label], i) => (
                <span key={k}>
                  {i > 0 && <span className="text-muted"> · </span>}
                  <span className="text-muted">{label}:</span> {next[k] || <span className="text-muted">not chosen</span>}
                </span>
              ))}
            </p>
          ))}

        <div id="agenda" className="scroll-mt-20">
          <h3 className="mb-2 font-semibold">Agenda{agenda.length ? ` (${agenda.length})` : ""}</h3>
          {agenda.length === 0 ? <Empty>Nothing on the agenda yet.</Empty> : <AgendaList items={agenda} tz={tz} canEdit reorder={editing} />}
          <form action={addAgenda} className="mt-3 flex flex-wrap gap-2">
            {editing && <input type="hidden" name="edit" value="1" />}
            <input name="body" maxLength={2000} required className="input min-w-0 flex-[2_1_14rem]" placeholder="Add something to discuss…" />
            <SectionSelect className="flex-[1_1_12rem]" />
            <SubmitButton className="btn-secondary">Add</SubmitButton>
          </form>
          <p className="hint mt-2">
            {editing
              ? "Use ⤒ (to the top) and ↑ / ↓ to put the agenda in order, or ✕ to take an item off. Tap Done editing when it's ready."
              : `Tap an item to change its wording or add notes. To put the agenda in order, tap ${next ? "Edit meeting" : "Edit agenda"}.`}{" "}
            Anyone in the presidency can add to it here, or tick &ldquo;Add to the next presidency meeting&rdquo; when sending a message or on a member&apos;s message.
            {next ? " In the meeting, tap Open meeting to take notes and make assignments." : " Schedule the next meeting below to choose who gives the prayers and the spiritual thought."}
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <details className="card" open={!next}>
            <summary className="cursor-pointer font-semibold">＋ Schedule a meeting</summary>
            <form action={newMeeting} className="mt-3 space-y-3">
              <select name="kind" className="input" aria-label="Which meeting" defaultValue="presidency">
                <option value="presidency">{roleLabel("presidency", user.org)} meeting</option>
                <option value="invited">Another meeting: invite people to it</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <Labeled label="Date">
                  <MeetingDateInput defaultValue={today} min={today} />
                </Labeled>
                <Labeled label="Time">
                  <input name="time" type="time" required defaultValue={lastTime} className="input" />
                </Labeled>
                <Labeled label="Title" hint="needed for another meeting" className="col-span-2 sm:col-span-1">
                  <input name="title" maxLength={120} className="input" />
                </Labeled>
                <Labeled label="Where" hint="optional" className="col-span-2 sm:col-span-1">
                  <input name="location" maxLength={200} className="input" />
                </Labeled>
              </div>
              <MeetingReminderFields id="new" first={reminderMin} second={0} />
              <RepeatFields initialStart={today} />
              <p className="hint -mt-1">Repeats is for {leadersWord(user.org)} meetings: the next two are always scheduled, each with its own agenda and notes.</p>
              <SubmitButton className="btn-primary w-full sm:w-auto">Schedule</SubmitButton>
              <p className="hint">
                Scheduling doesn&apos;t send anything right away. A {leadersWord(user.org)} meeting goes on the {leadersWord(user.org)}&apos;s calendar and their Coming up
                list on Home (only the {leadersWord(user.org)} sees it), and each of them gets the reminders chosen above, the way they get their other reminders. The
                usual first reminder is set under Settings → Reminder times. For another meeting (an activities committee, a teachers&apos; council…) you invite people
                next: they&apos;re notified right away, can say whether they&apos;ll come, and get the same reminders.
              </p>
            </form>
          </details>
          {later.length > 0 && <Section title="Also coming up">{list(later)}</Section>}
          <Section title="Past meetings" actions={past.some((m) => m.held_at) ? <PrintPastNotes ranges={NOTES_RANGES} /> : undefined}>
            {past.length === 0 ? <Empty>No meetings yet.</Empty> : list(past)}
          </Section>
          <HandbookLinks chapters={[chapter, MEETINGS]} />
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
