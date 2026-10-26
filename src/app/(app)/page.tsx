import Link from "next/link";
import { Fragment } from "react";
import { FlyerThumb } from "@/components/flyer-thumb";
import { OrgLink } from "@/components/org-link";
import { firstName } from "@/lib/names";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { adminCounts } from "@/lib/admin-counts";
import { eventWhenText, eventsBetween, isOngoing, ongoingText } from "@/lib/events";
import { upcomingLessons } from "@/lib/lessons";
import { getNotes } from "@/lib/lesson-notes";
import { listSignups, stillNeeded } from "@/lib/signups";
import {
  currentLessonDate,
  formatDate,
  formatDateTime,
  todayIn,
} from "@/lib/time";
import { Badge, Section } from "@/components/ui";
import { conferenceLabel, DateChip } from "@/components/lesson-bits";
import { QuickLinks } from "@/components/quick-links";
import { PushToggle } from "@/components/push-toggle";
import { askPath, pendingRequestsFor } from "@/lib/teaching-requests";
import { invitePath, pendingInvitesFor, whenText } from "@/lib/planned-visits";
import { hasFeature, leadersPhrase, myOrgs } from "@/lib/orgs";
import { withOrg } from "@/lib/org-cookie";
import { usesCfm } from "@/lib/cfm";
import { eventHref, personalEventsBetween } from "@/lib/personal-events";
import { assignmentRequestsFor, dueText, KIND_ICONS, myAssignments, soonAssignments } from "@/lib/assignments";
import { conductingSchedule, swapsWaitingOn } from "@/lib/conducting";
import { runningChallengesFor, scoreboard } from "@/lib/challenges";
import { ledOrgIds } from "@/lib/conversations";
import { homeLayout, type HomeSection } from "@/lib/home-layout";
import { handoffsWaitingOn } from "@/lib/assignment-handoffs";

export default async function HomePage() {
  const user = await requireUser();
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  // Everything coming up in every organization they belong to (and their wards), not
  // just the one they're looking at.
  const mine = myOrgs(user.id);
  if (!mine.some((o) => o.id === user.org_id)) mine.push({ ...user.org, label: user.orgLabel, role: user.role });
  // Links into another organization open there (?org=).
  const inOrg = (href: string, orgId: number) => (orgId === user.org_id ? href : withOrg(href, orgId));
  const lessonOrgs = mine.filter((o) => hasFeature(o, "lessons"));
  const lessonNexts = lessonOrgs.map((o) => ({ org: o, lesson: upcomingLessons(o.id, currentLessonDate(tz), lessonOrgs.length > 1 ? 1 : 3) }));
  const now = DateTime.now();
  // With their own events (only they see them).
  const events = [
    ...eventsBetween(user.id, now.toUTC().toISO()!, now.plus({ days: 45 }).toUTC().toISO()!, { joinedOnly: true }),
    ...personalEventsBetween(user.id, now.toUTC().toISO()!, now.plus({ days: 45 }).toUTC().toISO()!),
  ];
  // Coming up: events and everything with a date on their plate (assignments, to-dos,
  // lessons they're teaching, service they signed up for), in order. Something due on a
  // date with no time comes after that day's events (a lesson, at 9 AM).
  const until = now.setZone(tz).plus({ days: 45 }).toISODate()!;
  const dated = myAssignments(user.id, today).filter((i) => !i.done && i.date && i.date >= today && i.date <= until);
  const upcoming = [
    ...events.map((e) => ({ at: e.starts_at, event: e, item: undefined })),
    ...dated.map((i) => ({
      at: DateTime.fromISO(`${i.date}T${i.time ?? (i.kind === "teach" ? "09:00" : "23:59")}`, { zone: tz }).toUTC().toISO()!,
      event: undefined,
      item: i,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 8);
  const eventOrgs = new Set([...events.filter((e) => !e.personal_event_id).map((e) => e.org_id), ...dated.map((i) => i.orgId).filter(Boolean)]).size > 1;
  const signupOrgs = mine.filter((o) => hasFeature(o, "signups"));
  const signups = signupOrgs
    .flatMap((o) => listSignups(o.id, false, today).map((s) => ({ ...s, org: o })))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, 4);
  // Organizations a visit can be requested from.
  const visitOrgs = mine.filter((o) => hasFeature(o, "visits"));
  const { total: pending, shortcut } = adminCounts(user);
  const asks = pendingRequestsFor(user.id, today);
  const invites = pendingInvitesFor(user.id, today);
  const hour = DateTime.now().setZone(tz).hour;
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = firstName(user.display_name);
  // New to the ward: hasn't chosen any of its organizations yet.
  const groups = user.orgs.filter((o) => o.kind === "group");
  const chooseOrgs = groups.length > 0 && !groups.some((o) => o.joined);
  // What they've been asked to do, are teaching or signed up for, soon (or overdue).
  const assignments = soonAssignments(user.id, today);
  // Presidency members: who's conducting this Sunday in each organization they lead,
  // and anyone asking them to conduct.
  const led = ledOrgIds(user.id);
  const conducting = mine
    .filter((o) => led.includes(o.id) && hasFeature(o, "conducting"))
    .map((o) => ({ org: o, c: conductingSchedule(o.id, currentLessonDate(tz), 1)[0] }))
    .filter(({ c }) => c && (c.name || c.conference));
  const conductAsks = swapsWaitingOn(user.id, today).filter((a) => mine.some((o) => o.id === a.org_id && hasFeature(o, "conducting")));
  // Someone asking them (or their whole presidency) to take an assignment.
  const takeAsks = handoffsWaitingOn(user.id);
  // Assignments they've been asked to accept.
  const assignmentAsks = assignmentRequestsFor(user.id);
  // A challenge their organization is in: the scores, and a nudge to log.
  const challenges = runningChallengesFor(user.ward_id, user.id, today).map((c) => ({ c, board: scoreboard(c.id) }));

  // Each Home section, shown in the order the member chose.
  const conductingSection = (
    <>
      {conducting.map(({ org, c }) => (
        <Link key={org.id} href={inOrg("/conducting", org.id)} className="card mb-5 flex items-center justify-between gap-3 hover:bg-surface-2">
          <span className="min-w-0">
            <span className="block text-xs font-semibold tracking-wide text-accent uppercase">
              Conducting {c.date === today ? "today" : "this Sunday"}
              {conducting.length > 1 ? ` · ${org.label}` : ""}
            </span>
            <span className="block font-semibold">
              {c.conference ? `${c.conference}: no meeting` : c.memberId === user.id ? "You're conducting" : c.name}
            </span>
            {!c.conference && (
              <span className="text-sm text-muted">
                {c.insteadOf ? `Instead of ${c.insteadOf}` : c.calling}
                {c.pending ? ` · asked ${c.pending.toId === user.id ? "you" : c.pending.toName} to take it` : ""}
              </span>
            )}
          </span>
          <span className="text-muted">›</span>
        </Link>
      ))}
    </>
  );
  const assignmentsSection = (
    <>
      {assignments.length > 0 && (
        <Section
          title="Your assignments"
          actions={
            <Link href="/assignments" className="link text-sm">
              See all
            </Link>
          }
        >
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {assignments.slice(0, 4).map((i) => (
              <li key={i.key}>
                <OrgLink href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="text-lg" aria-hidden>
                    {KIND_ICONS[i.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.title}</span>
                    <span className="text-sm text-muted">{i.detail}</span>
                  </span>
                  {i.flag && <Badge tone={i.flag.tone}>{i.flag.text}</Badge>}
                </OrgLink>
              </li>
            ))}
          </ul>
          {assignments.length > 4 && (
            <Link href="/assignments" className="mt-2 block text-sm text-accent">
              {assignments.length - 4} more ›
            </Link>
          )}
        </Section>
      )}
    </>
  );
  const lessonsSection = (
    <>
      {lessonNexts.map(({ org, lesson: [next, ...later] }) => {
        const nextHasNotes = !!(next && getNotes(next.id)?.published_body);
        const many = lessonNexts.length > 1;
        // Sunday School: the week's Come, Follow Me (a teacher only on the Sundays class meets).
        const cfm = usesCfm(org);
        return (
          <Section
            key={org.id}
            title={`${many ? `${org.label}: ` : ""}${cfm ? "Come, Follow Me this week" : next && next.date === today ? "Today" : "This Sunday"}`}
            actions={
              <OrgLink href={inOrg("/lessons", org.id)} className="link text-sm">
                All lessons
              </OrgLink>
            }
          >
            {next ? (
              <OrgLink href={inOrg(`/lessons/${next.id}`, org.id)} className="card flex gap-4 hover:bg-surface-2">
                <DateChip date={next.date} highlight />
                <div className="min-w-0 flex-1">
                  {conferenceLabel(next.kind) ? (
                    <div className="font-semibold">
                      {conferenceLabel(next.kind)}: no {org.label} lesson
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold">{next.title || (cfm ? "Lesson to be announced" : next.topic ? "Topic to be announced" : "Talk to be announced")}</div>
                      {next.speaker && <div className="text-sm text-muted">{next.speaker}</div>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        {next.teacher_name ? (
                          <span className="text-muted">Teacher: {next.teacher_name}</span>
                        ) : cfm ? null : (
                          <Badge tone="warn">Teacher needed</Badge>
                        )}
                        {nextHasNotes && <Badge tone="info">Teacher&apos;s notes posted</Badge>}
                        {next.comment_count > 0 && <span className="text-muted">· {next.comment_count} comments</span>}
                      </div>
                      <div className="mt-3 text-sm font-semibold text-accent">Study and share your thoughts ›</div>
                    </>
                  )}
                </div>
              </OrgLink>
            ) : (
              <div className="card text-sm text-muted">No lesson posted yet.</div>
            )}
            {later.length > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {later.map((l) => (
                  <OrgLink
                    key={l.id}
                    href={inOrg(`/lessons/${l.id}`, org.id)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm hover:bg-surface-2"
                  >
                    <DateChip date={l.date} />
                    <span className="min-w-0 flex-1 truncate">{conferenceLabel(l.kind) ?? (l.title || (cfm ? "Lesson to be announced" : l.topic ? "Topic to be announced" : "Talk to be announced"))}</span>
                  </OrgLink>
                ))}
              </div>
            )}
          </Section>
        );
      })}
    </>
  );
  const comingUpSection = (
    <>
      <Section
        title="Coming up"
        actions={
          <Link href="/calendar" className="link text-sm">
            Calendar
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <div className="card text-sm text-muted">
            Nothing coming up in the next few weeks.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {upcoming.map(({ event: e, item: i }) =>
              i ? (
                <li key={i.key}>
                  <OrgLink href={i.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="text-lg" aria-hidden>
                      {KIND_ICONS[i.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.title}</span>
                      <span className="block text-sm text-muted">{i.detail}</span>
                      {eventOrgs && i.orgLabel && <span className="block text-xs text-muted">{i.orgLabel}</span>}
                    </span>
                    {i.flag && <Badge tone={i.flag.tone}>{i.flag.text}</Badge>}
                  </OrgLink>
                </li>
              ) : e ? (
              <li key={e.id}>
                <Link
                  href={eventHref(e)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  {e.flyer_file && <FlyerThumb file={e.flyer_file} name={e.flyer_name} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-sm text-muted">
                      {isOngoing(e) ? ongoingText(e, tz) : eventWhenText(e, tz)}
                      {e.location && ` · ${e.location}`}
                    </div>
                    {eventOrgs && !e.personal_event_id && <div className="text-xs text-muted">{e.org_label}</div>}
                  </div>
                  {e.personal_event_id ? (
                    <Badge tone="success">🔒 Only you</Badge>
                  ) : e.invited_meeting_id ? (
                    <Badge tone="info">Invited</Badge>
                  ) : (
                    !!e.presidency_only && <Badge tone="warn">Leaders only</Badge>
                  )}
                </Link>
              </li>
              ) : null,
            )}
          </ul>
        )}
      </Section>
    </>
  );
  const challengeSection = (
    <>
      {/* A challenge their organization is in: below Coming up. */}
      {challenges.map(({ c, board }) => (
        <Link key={c.id} href={`/challenges/${c.id}`} className="card mb-5 block hover:bg-surface-2">
          <span className="block text-xs font-semibold tracking-wide text-accent uppercase">🏆 {c.title}</span>
          <span className="mt-1 block text-sm">
            {board.map((b, i) => (
              <span key={b.team.id}>
                {i > 0 && " · "}
                <strong>{b.team.name}</strong> {Number.isInteger(b.points) ? b.points : b.points.toFixed(1)}
              </span>
            ))}
          </span>
          <span className="mt-1 block text-sm font-semibold text-accent">Log what you did ›</span>
        </Link>
      ))}
    </>
  );
  const serveSection = (
    <>
      {signups.length > 0 && (
        <Section
          title="Ways to serve"
          actions={
            <Link href="/signups" className="link text-sm">
              All service
            </Link>
          }
        >
          <ul className="space-y-2">
            {signups.map((s) => (
              <li key={s.id}>
                <OrgLink
                  href={inOrg(`/signups/${s.id}`, s.org.id)}
                  className="card flex items-center justify-between gap-3 hover:bg-surface-2"
                >
                  {s.flyer_file && <FlyerThumb file={s.flyer_file} name={s.flyer_name} />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.title}</span>
                    <span className="text-sm text-muted">
                      {[s.date && formatDate(s.date, "short"), signupOrgs.length > 1 && s.org.label].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {s.taken < s.capacity ? (
                    <Badge tone="info">{stillNeeded(s.capacity - s.taken)}</Badge>
                  ) : (
                    <Badge tone="success">Full</Badge>
                  )}
                </OrgLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
  const visitSection = (
    <>
      {visitOrgs.length > 0 && (
        <Link href="/more/visit" className="card mb-6 flex items-center justify-between gap-3 hover:bg-surface-2">
          <span>
            <span className="block font-medium">Would you like a visit?</span>
            <span className="text-sm text-muted">
              Ask {visitOrgs.length === 1 ? leadersPhrase(visitOrgs[0]) : "your leaders"} to come by, talk, or help.
            </span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      )}
    </>
  );
  const churchAppsSection = (
    <>
      <Section title="Church apps">
        <QuickLinks />
      </Section>
    </>
  );
  const blocks: Record<HomeSection, React.ReactNode> = {
    assignments: assignmentsSection,
    conducting: conductingSection,
    lessons: lessonsSection,
    coming_up: comingUpSection,
    challenge: challengeSection,
    serve: serveSection,
    visit: visitSection,
    church_apps: churchAppsSection,
  };
  const layout = homeLayout(user.id);

  return (
    <>
      <h1 className="h1 mb-1">
        {greeting}, {first}
      </h1>
      <p className="mb-5 text-sm text-muted">{formatDate(today)}</p>

      {pending > 0 && (
        <Link
          href={shortcut}
          className="mb-5 flex items-center justify-between rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn"
        >
          {pending} item{pending === 1 ? "" : "s"} waiting on you{" "}
          <span>›</span>
        </Link>
      )}

      {invites.map((p) => (
        <Link
          key={p.id}
          href={invitePath(p)}
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          <span>
            <span className="block font-semibold">
              The {user.orgs.find((o) => o.id === p.org_id)?.label ?? ""}{" "}
              {user.orgs.find((o) => o.id === p.org_id)?.kind === "ward"
                ? "bishopric"
                : "presidency"}{" "}
              would love to visit you
            </span>
            {whenText(p.date, p.time)}. Tap to reply.
          </span>
          <span>›</span>
        </Link>
      ))}
      {asks.map((r) => (
        <Link
          key={r.id}
          href={askPath(r)}
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          <span>
            <span className="block font-semibold">
              Will you teach on {formatDate(r.lesson_date, "short")}?
            </span>
            {r.asked_by_name ?? "The presidency"} asked
            {r.lesson_title ? ` about "${r.lesson_title}"` : ""}. Tap to answer.
          </span>
          <span>›</span>
        </Link>
      ))}

      {conductAsks.map((a) => (
        <Link
          key={a.id}
          href={inOrg(`/conducting#ask-${a.id}`, a.org_id)}
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          <span>
            <span className="block font-semibold">Can you conduct on {formatDate(a.date, "short")}?</span>
            {a.from_name ?? "Someone"} asked. Tap to answer.
          </span>
          <span>›</span>
        </Link>
      ))}

      {assignmentAsks.map((t) => (
        <Link
          key={t.id}
          href={withOrg(`/assignments/${t.id}`, t.org_id)}
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          <span>
            <span className="block font-semibold">Would you be willing to accept this assignment?</span>
            {t.title}
            {t.due_date ? ` · due ${dueText(t.due_date, t.due_time)}` : ""} · from {t.creator ?? "your presidency"}. Tap to answer.
          </span>
          <span>›</span>
        </Link>
      ))}

      {takeAsks.map((a) => (
        <Link
          key={a.id}
          href={withOrg(`/assignments/${a.todo_id}`, a.org_id)}
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          <span>
            <span className="block font-semibold">Can you take this assignment?</span>
            {a.title} · {a.from_name ?? "Someone"} asked{a.whole ? " the presidency" : ""}. Tap to answer.
          </span>
          <span>›</span>
        </Link>
      ))}

      {chooseOrgs && (
        <Link href="/more/organizations" className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          <span>
            <span className="block font-semibold">Which organizations are you in?</span>
            Choose them to get their reminders and messages. Tap to choose.
          </span>
          <span>›</span>
        </Link>
      )}

      <div className="mb-5">
        <PushToggle compact />
      </div>

      {/* Their sections, in the order they chose (More → Customize Home). */}
      {layout.order
        .filter((k) => !layout.hidden.includes(k))
        .map((k) => (
          <Fragment key={k}>{blocks[k]}</Fragment>
        ))}

      <p className="mt-2 text-center text-sm">
        <Link href="/more/home" className="link">
          Customize Home
        </Link>
      </p>
    </>
  );
}
