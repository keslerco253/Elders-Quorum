import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  markGeneralConferences,
  openLessonSundays,
  upcomingLessons,
} from "@/lib/lessons";
import { formatDate, sundayOnOrAfter, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { conferenceLabel } from "@/components/lesson-bits";
import { addSundays, fillTalks, saveRegular } from "./actions";
import { fillRegularTeachers, regularByTeacher, regularTeachers, weeksText, WEEK_WORDS, WEEKS } from "@/lib/regular-teachers";
import { orgRoster } from "@/lib/orgs";
import { isPresidency } from "@/lib/permissions";
import { ensureCfmLessons, lastCfmSunday, usesCfm } from "@/lib/cfm";

export const metadata = { title: "Manage lessons" };

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  // Sunday School: every week is filled from Come, Follow Me.
  const cfm = usesCfm(user.org);
  const cfmThrough = cfm ? lastCfmSunday() : undefined;
  if (cfm) ensureCfmLessons(user.org_id, today);
  // General Conference Sundays (first Sunday of April and October) are marked on their own.
  markGeneralConferences(user.org_id, today);
  fillRegularTeachers(user.org_id, today);
  const regular = regularTeachers(user.org_id);
  const regularSummary = regularByTeacher(user.org_id);
  const roster = isPresidency(user) ? orgRoster(user.org_id) : [];
  const lessons = upcomingLessons(user.org_id, today, 80);
  // Where pasted links go: Sundays from today with no talk yet, in order.
  const open = openLessonSundays(user.org_id, today);
  const last = lessons.at(-1)?.date;
  const nextStart = last
    ? sundayOnOrAfter(
        new Date(Date.parse(last) + 86400000 * 7).toISOString().slice(0, 10),
      )
    : sundayOnOrAfter(today);

  return (
    <>
      <PageHeader
        title="Manage lessons"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={
          cfm
            ? "Every week's Come, Follow Me lesson, filled in for you."
            : "Set up six months of lessons after each General Conference."
        }
      />
      <Flash msg={sp.msg} />

      {cfm ? (
        <div className="card mb-6 space-y-2 text-sm">
          <h2 className="h2">Come, Follow Me</h2>
          {cfmThrough && cfmThrough >= today ? (
            <p>
              Every week through{" "}
              <strong>{formatDate(cfmThrough, "short")}</strong> is filled from
              Come, Follow Me: the reading, the lesson&apos;s title and a link
              to it in Gospel Library. Members get a reminder each Sunday
              evening of the coming week&apos;s reading. General Conference
              Sundays are marked for you.
            </p>
          ) : (
            <p>
              The Come, Follow Me schedule for this year hasn&apos;t been loaded
              yet. The site owner loads it once a year; lessons fill in as soon
              as it is.
            </p>
          )}
          <p className="text-muted">
            Tap a Sunday to assign a teacher, mark Stake Conference, or change
            the lesson. What you change stays as you set it, and you can put it
            back to the Come, Follow Me lesson anytime.
          </p>
          {user.is_site_owner && (
            <Link href="/site#cfm" className="link">
              Load or update the schedule (site owner)
            </Link>
          )}
        </div>
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <form action={addSundays} className="card space-y-3">
            <h2 className="h2">1. Add Sundays</h2>
            <p className="text-sm text-muted">
              Creates a blank lesson for every Sunday. Sundays that already have
              a lesson are skipped.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="start">
                  Starting
                </label>
                <input
                  id="start"
                  name="start"
                  type="date"
                  required
                  defaultValue={nextStart}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="weeks">
                  Weeks
                </label>
                <input
                  id="weeks"
                  name="weeks"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={26}
                  className="input"
                />
              </div>
            </div>
            <SubmitButton>Add Sundays</SubmitButton>
          </form>

          <form action={fillTalks} className="card space-y-3">
            <h2 className="h2">2. Paste talk links</h2>
            <p className="text-sm text-muted">
              Paste Gospel Library talk links in order, one per line. They fill
              the open Sundays in date order, skipping any that are already
              filled, and titles and speakers are looked up automatically.
              General Conference Sundays are marked for you; mark any Stake
              Conference Sunday first (tap it below) so it&apos;s skipped.
            </p>
            <textarea
              name="urls"
              rows={4}
              className="input font-mono text-xs"
              placeholder="https://www.churchofjesuschrist.org/study/general-conference/…"
            />
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              {open.length ? (
                <>
                  Starts at the next open Sunday,{" "}
                  <strong>{formatDate(open[0].date, "short")}</strong>, and
                  skips Sundays that already have a talk or a conference
                  {open.length > 1
                    ? ` (${open.length} open Sundays ahead).`
                    : " (the only open Sunday)."}
                </>
              ) : (
                "Every Sunday ahead already has a talk. Add Sundays first."
              )}
            </p>
            <SubmitButton pendingText="Looking up talks…">
              Fill lessons
            </SubmitButton>
          </form>
        </div>
      )}

      {isPresidency(user) && (
        <form action={saveRegular} id="regular" className="card mb-6 scroll-mt-20 space-y-3">
          <h2 className="h2">Regular teachers</h2>
          <p className="text-sm text-muted">
            Someone who teaches the same Sunday each month is put on those lessons
            automatically. One teacher per Sunday; a teacher can have more than one
            (for example the 2nd and 4th).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {WEEKS.map((w) => (
              <div key={w}>
                <label className="label" htmlFor={`week${w}`}>
                  {WEEK_WORDS[w - 1]} Sunday
                </label>
                <select id={`week${w}`} name={`week${w}`} className="input" defaultValue={regular.find((r) => r.week === w)?.member_id ?? ""}>
                  <option value="">No regular teacher</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {regularSummary.length > 0 && (
            <ul className="text-sm">
              {regularSummary.map((t) => (
                <li key={t.member_id}>
                  <strong>{t.display_name}</strong>: {weeksText(t.weeks)}
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            5th Sundays never get a regular teacher: assign someone, or members can
            offer to teach. Conference Sundays are skipped. Taking a regular
            teacher off one lesson (or them saying they can&apos;t) leaves that
            Sunday open; it isn&apos;t filled again. Changing a Sunday&apos;s
            regular teacher moves the upcoming lessons they were put on to the
            new teacher. Teachers are notified when added or taken off.
          </p>
          <SubmitButton>Save regular teachers</SubmitButton>
        </form>
      )}

      <h2 className="h2 mb-2">Each Sunday</h2>
      <p className="mb-2 text-sm text-muted">
        Tap a Sunday to {cfm ? "change the lesson" : "change the talk"}, mark a
        conference, or assign a teacher.
      </p>
      {lessons.length === 0 ? (
        <Empty>No upcoming lessons yet. Start with step 1.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {lessons.map((l) => {
            const conf = conferenceLabel(l.kind);
            return (
              <li key={l.id}>
                <Link
                  href={`/admin/lessons/${l.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <div className="w-24 shrink-0 text-sm font-semibold">
                    {formatDate(l.date, "short")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      {conf ??
                        (l.title || (
                          <span className="text-muted">
                            {cfm ? "No lesson yet" : "No talk yet"}
                          </span>
                        ))}
                    </div>
                    {!conf && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        {l.teacher_name ? (
                          <span>
                            Teacher: {l.teacher_name}
                            {l.teacher_confirmed_at && (
                              <span className="ml-1 text-success">
                                ✓ confirmed
                              </span>
                            )}
                            {!!l.teacher_auto && (
                              <span className="ml-1">· regular</span>
                            )}
                          </span>
                        ) : cfm && !l.decline_count ? (
                          <span>No teacher</span>
                        ) : (
                          <Badge tone="warn">
                            {l.decline_count > 0
                              ? "Teacher can't teach"
                              : "No teacher"}
                          </Badge>
                        )}
                        {l.volunteer_count > 0 && !l.teacher_name && (
                          <Badge tone="info">
                            {l.volunteer_count} volunteered
                          </Badge>
                        )}
                        {l.asked_names && !l.teacher_name && (
                          <Badge tone="info">Asked {l.asked_names}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  {conf && <Badge tone="info">Conference</Badge>}
                  <span className="text-muted">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
