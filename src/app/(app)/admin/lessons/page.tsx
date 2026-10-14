import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { upcomingLessons } from "@/lib/lessons";
import { formatDate, sundayOnOrAfter, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { conferenceLabel } from "@/components/lesson-bits";
import { addSundays, fillTalks } from "./actions";

export const metadata = { title: "Manage lessons" };

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const lessons = upcomingLessons(user.org_id, today, 80);
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
        subtitle="Set up six months of lessons after each General Conference."
      />
      <Flash msg={sp.msg} />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <form action={addSundays} className="card space-y-3">
          <h2 className="h2">1. Add Sundays</h2>
          <p className="text-sm text-muted">
            Creates a blank lesson for every Sunday. Sundays that already have a
            lesson are skipped.
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
            the open Sundays in date order, and titles and speakers are looked
            up automatically. Tip: first mark General and Stake Conference
            Sundays (tap a Sunday below) so they&apos;re skipped.
          </p>
          <textarea
            name="urls"
            rows={4}
            className="input font-mono text-xs"
            placeholder="https://www.churchofjesuschrist.org/study/general-conference/…"
          />
          <div>
            <label className="label" htmlFor="from">
              Fill starting from
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={sundayOnOrAfter(today)}
              className="input"
            />
          </div>
          <SubmitButton pendingText="Looking up talks…">
            Fill lessons
          </SubmitButton>
        </form>
      </div>

      <h2 className="h2 mb-2">Each Sunday</h2>
      <p className="mb-2 text-sm text-muted">
        Tap a Sunday to change the talk, mark a conference, or assign a teacher.
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
                          <span className="text-muted">No talk yet</span>
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
                          </span>
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
                        {l.asked_names && !l.teacher_name && <Badge tone="info">Asked {l.asked_names}</Badge>}
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
