import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { usesCfm } from "@/lib/cfm";
import { pastLessons, upcomingLessons } from "@/lib/lessons";
import { currentLessonDate, todayIn } from "@/lib/time";
import { isAdmin } from "@/lib/permissions";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { conferenceLabel, DateChip } from "@/components/lesson-bits";

export const metadata = { title: "Lessons" };

export default async function LessonsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const cfm = usesCfm(user.org);
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const past = sp.show === "past";
  // After 1 PM on Sunday, that day's lesson moves to "Past".
  const nextSunday = currentLessonDate(user.ward.timezone);
  const lessons = past ? pastLessons(user.org_id, nextSunday) : upcomingLessons(user.org_id, nextSunday);

  return (
    <>
      <PageHeader
        title="Lessons"
        subtitle="Study ahead and share what you learn. Tap a lesson to read the talk and join the discussion."
        actions={
          isAdmin(user) && (
            <Link href="/admin/lessons" className="btn-secondary">
              Manage lessons
            </Link>
          )
        }
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/lessons" className={`rounded-full px-3 py-1 font-medium ${!past ? "bg-primary text-primary-text" : "bg-surface-2 text-muted"}`}>
          Upcoming
        </Link>
        <Link href="/lessons?show=past" className={`rounded-full px-3 py-1 font-medium ${past ? "bg-primary text-primary-text" : "bg-surface-2 text-muted"}`}>
          Past
        </Link>
      </div>
      {lessons.length === 0 ? (
        <Empty>{past ? "No past lessons yet." : "No upcoming lessons have been posted yet."}</Empty>
      ) : (
        <ul className="space-y-2">
          {lessons.map((l) => {
            const conf = conferenceLabel(l.kind);
            const isNext = l.date === nextSunday;
            return (
              <li key={l.id}>
                <Link href={`/lessons/${l.id}`} className={`flex items-center gap-3 rounded-xl border bg-surface p-3 hover:bg-surface-2 ${isNext ? "border-primary/50" : "border-border"}`}>
                  <DateChip date={l.date} highlight={isNext} />
                  <div className="min-w-0 flex-1">
                    {isNext && <div className="text-xs font-semibold uppercase tracking-wide text-accent">{l.date === today ? "Today" : "This Sunday"}</div>}
                    {conf ? (
                      <div className="font-semibold">{conf}</div>
                    ) : (
                      <>
                        <div className="truncate font-semibold">{l.title || (cfm ? "Lesson to be announced" : "Talk to be announced")}</div>
                        <div className="truncate text-sm text-muted">{l.speaker}</div>
                      </>
                    )}
                    {!conf && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {l.teacher_name ? <span>Teacher: {l.teacher_name}</span> : cfm ? null : <Badge tone="warn">Teacher needed</Badge>}
                        {l.comment_count > 0 && <span>· {l.comment_count} comment{l.comment_count === 1 ? "" : "s"}</span>}
                      </div>
                    )}
                  </div>
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
