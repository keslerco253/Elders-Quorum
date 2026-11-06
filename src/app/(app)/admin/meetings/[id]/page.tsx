import { hasFeature } from "@/lib/orgs";
import { AssignmentReview } from "../assignment-review";
import { Labeled } from "@/components/labeled";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { attendeeChoices, getMeeting, inviteGroups, MEETING_ROLES, meetingInvitees, meetingAgenda, meetingName, meetingReminders, pendingAgenda, videoKind, videoLink } from "@/lib/meetings";
import { DateTime } from "luxon";
import { Linkify } from "@/components/linkify";
import { orgTodos, STATUS_LABELS } from "@/lib/assignments";
import { orgPresidency, orgRoster } from "@/lib/orgs";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { AssignmentForm } from "@/components/assignment-form";
import { AgendaList } from "../agenda-list";
import { KeepDraft } from "@/components/keep-draft";
import { stopRepeating, addAgenda, deleteMeeting, finish, inviteToMeetingAction, saveMeeting, saveMeetingRole, startVideo, uninviteAction } from "../actions";
import { RoleSelect } from "../role-select";
import { PrintAgendaButton } from "../print-agenda";
import { MeetingReminderFields } from "../reminder-fields";
import { DOCUMENT_ACCEPT } from "@/lib/upload-names";
import { SectionSelect } from "../section-select";
import { getMeetingSeries, seriesText } from "@/lib/meeting-series";

export const metadata = { title: "Presidency meeting" };

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const m = getMeeting(user.org_id, Number((await params).id));
  if (!m) notFound();
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const held = !!m.held_at;
  // A meeting people were invited to has its own agenda from the start.
  const invited = m.kind === "invited";
  const own = invited ? meetingAgenda(m.id) : [];
  // Before it's finished a presidency meeting works from the waiting agenda; after, from what was filed with it.
  const filed = invited ? [] : meetingAgenda(m.id);
  const waiting = held || invited ? [] : pendingAgenda(user.org_id);
  const presidency = orgPresidency(user.org_id);
  const invitees = invited ? meetingInvitees(m.id) : [];
  const roster = invited ? orgRoster(user.org_id).filter((p) => !invitees.some((i) => i.member_id === p.id)) : [];
  // The presidency and anyone with a calling here (secretaries, a high councilor); for
  // an invited meeting, the people invited first.
  const leaders = attendeeChoices(user.org_id);
  const choices = invited
    ? [...invitees.map((i) => ({ id: i.member_id, name: i.display_name, calling: null })), ...leaders.filter((p) => p.id > 0 && !invitees.some((i) => i.display_name === p.name))]
    : leaders;
  const attending = m.attendees.split(",").map((s) => s.trim()).filter(Boolean);
  const others = attending.filter((n) => !choices.some((p) => p.name === n));
  const names = choices.filter((p) => p.id > 0).map((p) => p.name);
  const roleSelect = (role: (typeof MEETING_ROLES)[number]) => (
    <RoleSelect key={role[0]} action={saveMeetingRole} meetingId={m.id} role={role[0]} label={role[1]} value={m[role[0]]} names={names} />
  );
  // The record: what was noted on each agenda item.
  const noted = [...own, ...filed, ...waiting].filter((a) => a.notes);
  const time = m.time ? DateTime.fromFormat(m.time, "HH:mm").toFormat("h:mm a") : null;
  const todos = orgTodos(user.org_id, { meetingId: m.id });
  const from = sp.assign ? [...own, ...waiting, ...filed].find((a) => a.id === Number(sp.assign)) : undefined;
  const back = `/admin/meetings/${m.id}`;
  // The presidency's own video link, for its own meetings.
  const video = held || invited ? null : videoLink(user.org_id);
  // Edit meeting: put the agenda in order (and take items off).
  const editing = sp.edit === "1" && !held;
  // An item just put under another section (shown there).
  const moved = Number(sp.moved) || undefined;
  const series = m.series_id ? getMeetingSeries(user.org_id, m.series_id) : undefined;

  return (
    <>
      <PageHeader
        title={`${meetingName(user.org_id, m)} · ${formatDate(m.date, "short")}${time ? ` · ${time}` : ""}`}
        back={{ href: "/admin/meetings", label: "Meetings" }}
        subtitle={
          held
            ? `Finished. Tap an agenda item to correct or add to its notes, or change the notes below. ${m.review_at ? `Up for review ${formatDate(m.review_at, "short")}.` : ""}`
            : invited
              ? `${m.location ? `${m.location}. ` : ""}For the people invited: they see the agenda and the prayers, not the notes.`
              : m.date > today
              ? "Scheduled. Add to the agenda anytime; in the meeting, tap an item to take notes on it."
              : "Tap an agenda item to take notes on it; tick what was discussed, then finish the meeting."
        }
      />
      <Flash msg={sp.msg} />
      {series && (
        <form action={stopRepeating} className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="meeting_id" value={m.id} />
          <span className="text-muted">🔁 {series.active ? seriesText(series) : "Was repeating (stopped)"}</span>
          {!!series.active && (
            <SubmitButton className="btn-secondary btn-sm" confirm="Stop repeating? Meetings already scheduled stay." pendingText="…">
              Stop repeating
            </SubmitButton>
          )}
        </form>
      )}
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
          {invited && (
            <div id="invite" className="card scroll-mt-20 space-y-3">
              <h2 className="h2">Invited ({invitees.length})</h2>
              {invitees.length === 0 ? (
                <p className="text-sm text-muted">No one yet. Invite people by calling or by name; they&apos;re notified right away.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                  {invitees.map((i) => (
                    <li key={i.member_id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="mr-auto">{i.display_name}</span>
                      {i.response === "yes" ? <Badge tone="success">Coming</Badge> : i.response === "no" ? <Badge tone="danger">Can&apos;t come</Badge> : <Badge>No answer</Badge>}
                      <form action={uninviteAction}>
                        <input type="hidden" name="meeting_id" value={m.id} />
                        <input type="hidden" name="member_id" value={i.member_id} />
                        <SubmitButton className="btn-secondary btn-sm" confirm={`Take ${i.display_name} off the invitation list?`} pendingText="…">
                          ✕
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {!held && (
                <>
                  <form action={inviteToMeetingAction} className="flex gap-2">
                    <input type="hidden" name="meeting_id" value={m.id} />
                    <select name="group" className="input flex-1" required defaultValue="" aria-label="Invite by calling">
                      <option value="" disabled>
                        Invite by calling…
                      </option>
                      {inviteGroups(user.org_id).map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label} ({g.ids.length})
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn-secondary">Invite</SubmitButton>
                  </form>
                  {roster.length > 0 && (
                    <form action={inviteToMeetingAction} className="flex gap-2">
                      <input type="hidden" name="meeting_id" value={m.id} />
                      <select name="member_id" className="input flex-1" required defaultValue="" aria-label="Invite a person">
                        <option value="" disabled>
                          Invite by name…
                        </option>
                        {roster.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.display_name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="btn-secondary">Invite</SubmitButton>
                    </form>
                  )}
                  <p className="hint">They get an invitation, can answer whether they&apos;ll come, and see it on their calendar and Home with a reminder before it starts.</p>
                </>
              )}
            </div>
          )}
          <div id="agenda" className="scroll-mt-20" />
          <Section
            title="Agenda"
            actions={
              <div className="flex flex-wrap gap-2">
                <PrintAgendaButton meetingId={m.id} finished={held} />
                {!held &&
                  (editing ? (
                    <Link href={`/admin/meetings/${m.id}#agenda`} className="btn-primary btn-sm">
                      ✓ Done editing
                    </Link>
                  ) : (
                    <Link href={`/admin/meetings/${m.id}?edit=1#agenda`} className="btn-secondary btn-sm">
                      ✏️ Edit meeting
                    </Link>
                  ))}
              </div>
            }
          >
            <div className="mb-3 space-y-2">{MEETING_ROLES.slice(0, 2).map(roleSelect)}</div>
            {/* Add at the top, before the agenda. */}
            {!held && (
              <form action={addAgenda} className="mb-4 flex flex-wrap gap-2">
                <input type="hidden" name="meeting_id" value={m.id} />
                {editing && <input type="hidden" name="edit" value="1" />}
                <KeepDraft id={`agenda-add:${user.org_id}:${invited ? m.id : "next"}`} addsTo="data-agenda-body" />
                <input name="body" maxLength={2000} required className="input min-w-0 flex-[2_1_14rem]" placeholder="Add something to discuss…" />
                <SectionSelect className="flex-[1_1_12rem]" />
                <SubmitButton className="btn-secondary">Add</SubmitButton>
                <label className="basis-full text-xs text-muted">
                  📎 Attach files (optional)
                  <input type="file" name="files" multiple accept={DOCUMENT_ACCEPT} className="mt-1 block w-full text-sm" />
                </label>
              </form>
            )}
            {own.length + waiting.length + filed.length === 0 ? (
              <Empty>Nothing on the agenda.</Empty>
            ) : (
              <div className="space-y-3">
                {own.length > 0 && <AgendaList items={own} tz={tz} meetingId={m.id} canEdit finished={held} reorder={editing} moved={moved} />}
                {filed.length > 0 && <AgendaList items={filed} tz={tz} meetingId={m.id} canEdit finished moved={moved} />}
                {waiting.length > 0 && <AgendaList items={waiting} tz={tz} meetingId={m.id} canEdit reorder={editing} upcoming={m.date > today} moved={moved} />}
              </div>
            )}
            {!held && !invited && hasFeature(user.org, "todos") && (
              <div className="mt-5">
                <AssignmentReview orgId={user.org_id} meetingId={m.id} today={today} tz={tz} />
              </div>
            )}
            <div className="mt-3">{roleSelect(MEETING_ROLES[2])}</div>
            {!held && (
              <>
                <form action={finish} className="mt-4">
                  <input type="hidden" name="meeting_id" value={m.id} />
                  <SubmitButton
                    className="btn-primary"
                    confirm={invited ? "Finish the meeting?" : "Finish the meeting? Ticked items are filed with it; the rest wait for the next meeting."}
                    pendingText="Finishing…"
                  >
                    Finish meeting
                  </SubmitButton>
                  {!invited && <p className="hint mt-1">Ticked items are filed with this meeting. Anything not ticked stays on the agenda for next time.</p>}
                </form>
              </>
            )}
          </Section>

          <form action={saveMeeting} className="card space-y-3">
            <input type="hidden" name="meeting_id" value={m.id} />
            <KeepDraft id={`meeting-notes:${m.id}`} />
            <h2 className="h2">Notes</h2>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Date">
                <input name="date" type="date" required defaultValue={m.date} className="input" />
              </Labeled>
              <Labeled label="Time">
                <input name="time" type="time" defaultValue={m.time ?? ""} className="input" />
              </Labeled>
              <Labeled label="Title" hint={invited ? undefined : "optional"} className="col-span-2">
                <input name="title" maxLength={120} defaultValue={m.title} required={invited} className="input" />
              </Labeled>
              <Labeled label="Where" hint="optional" className="col-span-2">
                <input name="location" maxLength={200} defaultValue={m.location} className="input" />
              </Labeled>
            </div>
            {!held && <MeetingReminderFields id="meeting" first={meetingReminders(user.org_id, m)[0] ?? 0} second={meetingReminders(user.org_id, m)[1] ?? 0} />}
            <fieldset>
              <legend className="label">Who was there</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {choices.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="att" value={p.name} defaultChecked={attending.includes(p.name)} /> {p.name}
                    {p.calling && <span className="text-xs text-muted">({p.calling})</span>}
                  </label>
                ))}
              </div>
              <input name="att_other" defaultValue={others.join(", ")} className="input mt-2" placeholder="Others (names, separated by commas)" />
            </fieldset>
            <div>
              <span className="label">From the agenda</span>
              {noted.length === 0 ? (
                <p className="text-sm text-muted">Notes taken on agenda items show here as the meeting&apos;s record.</p>
              ) : (
                <ul className="space-y-2">
                  {noted.map((a) => (
                    <li key={a.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <a href={`#item-${a.id}`} className="block font-medium">
                        {a.body.length > 120 ? `${a.body.slice(0, 117)}…` : a.body}
                      </a>
                      <div className="mt-0.5 whitespace-pre-wrap break-words">
                        <Linkify text={a.notes} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="label" htmlFor="other-notes">
              Other notes <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id="other-notes" name="notes" rows={m.notes ? 10 : 4} defaultValue={m.notes} className="input text-sm" placeholder="Anything that wasn't on the agenda…" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="hint">Keep notes brief, and only what&apos;s needed.</span>
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
