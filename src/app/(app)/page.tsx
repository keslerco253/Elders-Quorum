import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { adminCounts } from "@/lib/admin-counts";
import { eventsBetween } from "@/lib/events";
import { upcomingLessons } from "@/lib/lessons";
import { getNotes } from "@/lib/lesson-notes";
import { listSignups } from "@/lib/signups";
import { currentLessonDate, formatDate, formatDateTime, todayIn } from "@/lib/time";
import { Badge, Section } from "@/components/ui";
import { conferenceLabel, DateChip } from "@/components/lesson-bits";
import { QuickLinks } from "@/components/quick-links";
import { PushToggle } from "@/components/push-toggle";

export default async function HomePage() {
  const user = await requireUser();
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const lessons = upcomingLessons(user.ward_id, currentLessonDate(tz), 3);
  const [next, ...later] = lessons;
  const nextHasNotes = !!(next && getNotes(next.id)?.published_body);
  const now = DateTime.now();
  const events = eventsBetween(user, now.toUTC().toISO()!, now.plus({ days: 45 }).toUTC().toISO()!).slice(0, 4);
  const signups = listSignups(user.ward_id, false, today).slice(0, 3);
  const pending = adminCounts(user).total;
  const hour = DateTime.now().setZone(tz).hour;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user.display_name.split(" ")[0];

  return (
    <>
      <h1 className="h1 mb-1">
        {greeting}, {first}
      </h1>
      <p className="mb-5 text-sm text-muted">{formatDate(today)}</p>

      {pending > 0 && (
        <Link href="/admin" className="mb-5 flex items-center justify-between rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          {pending} item{pending === 1 ? "" : "s"} waiting for your approval <span>›</span>
        </Link>
      )}

      <div className="mb-5">
        <PushToggle compact />
      </div>

      <Section
        title={next && next.date === today ? "Today" : "This Sunday"}
        actions={
          <Link href="/lessons" className="link text-sm">
            All lessons
          </Link>
        }
      >
        {next ? (
          <Link href={`/lessons/${next.id}`} className="card flex gap-4 hover:bg-surface-2">
            <DateChip date={next.date} highlight />
            <div className="min-w-0 flex-1">
              {conferenceLabel(next.kind) ? (
                <div className="font-semibold">{conferenceLabel(next.kind)}: no quorum lesson</div>
              ) : (
                <>
                  <div className="font-semibold">{next.title || "Talk to be announced"}</div>
                  {next.speaker && <div className="text-sm text-muted">{next.speaker}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    {next.teacher_name ? <span className="text-muted">Teacher: {next.teacher_name}</span> : <Badge tone="warn">Teacher needed</Badge>}
                    {nextHasNotes && <Badge tone="info">Teacher&apos;s notes posted</Badge>}
                    {next.comment_count > 0 && <span className="text-muted">· {next.comment_count} comments</span>}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-accent">Study and share your thoughts ›</div>
                </>
              )}
            </div>
          </Link>
        ) : (
          <div className="card text-sm text-muted">No lesson posted yet.</div>
        )}
        {later.length > 0 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {later.map((l) => (
              <Link key={l.id} href={`/lessons/${l.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm hover:bg-surface-2">
                <DateChip date={l.date} />
                <span className="min-w-0 flex-1 truncate">{conferenceLabel(l.kind) ?? (l.title || "Talk to be announced")}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Coming up"
        actions={
          <Link href="/calendar" className="link text-sm">
            Calendar
          </Link>
        }
      >
        {events.length === 0 ? (
          <div className="card text-sm text-muted">Nothing on the calendar in the next few weeks.</div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/calendar/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-sm text-muted">
                      {formatDateTime(e.starts_at, tz)}
                      {e.location && ` · ${e.location}`}
                    </div>
                  </div>
                  {!!e.presidency_only && <Badge tone="warn">Presidency</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {signups.length > 0 && (
        <Section
          title="Ways to help"
          actions={
            <Link href="/signups" className="link text-sm">
              All sign-ups
            </Link>
          }
        >
          <ul className="space-y-2">
            {signups.map((s) => (
              <li key={s.id}>
                <Link href={`/signups/${s.id}`} className="card flex items-center justify-between gap-3 hover:bg-surface-2">
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    {s.date && <span className="text-sm text-muted">{formatDate(s.date, "short")}</span>}
                  </span>
                  {s.taken < s.capacity ? <Badge tone="info">{s.capacity - s.taken} open</Badge> : <Badge tone="success">Full</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Church apps">
        <QuickLinks />
      </Section>
    </>
  );
}
