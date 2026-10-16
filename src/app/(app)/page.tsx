import Link from "next/link";
import { FlyerThumb } from "@/components/flyer-thumb";
import { OrgLink } from "@/components/org-link";
import { firstName } from "@/lib/names";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { adminCounts } from "@/lib/admin-counts";
import { eventsBetween } from "@/lib/events";
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
  const events = eventsBetween(user.id, now.toUTC().toISO()!, now.plus({ days: 45 }).toUTC().toISO()!, { joinedOnly: true }).slice(0, 6);
  const eventOrgs = new Set(events.map((e) => e.org_id)).size > 1;
  const signupOrgs = mine.filter((o) => hasFeature(o, "signups"));
  const signups = signupOrgs
    .flatMap((o) => listSignups(o.id, false, today).map((s) => ({ ...s, org: o })))
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, 4);
  // Organizations a visit can be requested from.
  const visitOrgs = mine.filter((o) => hasFeature(o, "visits"));
  const pending = adminCounts(user).total;
  const asks = pendingRequestsFor(user.id, today);
  const invites = pendingInvitesFor(user.id, today);
  const hour = DateTime.now().setZone(tz).hour;
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = firstName(user.display_name);
  // New to the ward: hasn't chosen any of its organizations yet.
  const groups = user.orgs.filter((o) => o.kind === "group");
  const chooseOrgs = groups.length > 0 && !groups.some((o) => o.joined);

  return (
    <>
      <h1 className="h1 mb-1">
        {greeting}, {first}
      </h1>
      <p className="mb-5 text-sm text-muted">{formatDate(today)}</p>

      {pending > 0 && (
        <Link
          href="/admin"
          className="mb-5 flex items-center justify-between rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn"
        >
          {pending} item{pending === 1 ? "" : "s"} waiting for your approval{" "}
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
                      <div className="font-semibold">{next.title || (cfm ? "Lesson to be announced" : "Talk to be announced")}</div>
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
                    <span className="min-w-0 flex-1 truncate">{conferenceLabel(l.kind) ?? (l.title || (cfm ? "Lesson to be announced" : "Talk to be announced"))}</span>
                  </OrgLink>
                ))}
              </div>
            )}
          </Section>
        );
      })}

      <Section
        title="Coming up"
        actions={
          <Link href="/calendar" className="link text-sm">
            Calendar
          </Link>
        }
      >
        {events.length === 0 ? (
          <div className="card text-sm text-muted">
            Nothing on the calendar in the next few weeks.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/calendar/${e.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  {e.flyer_file && <FlyerThumb file={e.flyer_file} name={e.flyer_name} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-sm text-muted">
                      {formatDateTime(e.starts_at, tz)}
                      {e.location && ` · ${e.location}`}
                    </div>
                    {eventOrgs && <div className="text-xs text-muted">{e.org_label}</div>}
                  </div>
                  {!!e.presidency_only && <Badge tone="warn">Leaders only</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

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

      <Section title="Church apps">
        <QuickLinks />
      </Section>
    </>
  );
}
