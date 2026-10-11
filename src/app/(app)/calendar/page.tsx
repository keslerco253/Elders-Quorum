import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { eventsBetween } from "@/lib/events";
import { isAdmin } from "@/lib/permissions";
import { formatDateTime, formatTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const now = DateTime.now().setZone(tz);
  const parsed = sp.m ? DateTime.fromFormat(sp.m, "yyyy-LL", { zone: tz }) : now;
  const month = (parsed.isValid ? parsed : now).startOf("month");
  const gridStart = month.minus({ days: month.weekday % 7 });
  const gridEnd = month.endOf("month").plus({ days: 6 - (month.endOf("month").weekday % 7) }).endOf("day");
  const events = eventsBetween(user, gridStart.toUTC().toISO()!, gridEnd.toUTC().toISO()!);
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const k = DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).toISODate()!;
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days: DateTime[] = [];
  for (let d = gridStart; d <= gridEnd; d = d.plus({ days: 1 })) days.push(d);
  const monthEvents = events.filter((e) => DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).hasSame(month, "month"));
  const upcoming = month.hasSame(now, "month") ? monthEvents.filter((e) => e.ends_at >= now.toUTC().toISO()!) : monthEvents;
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <>
            {admin && (
              <Link href="/admin/events/new" className="btn-primary">
                Add event
              </Link>
            )}
            {!admin && (
              <Link href="/calendar/request" className="btn-secondary">
                Request an event
              </Link>
            )}
          </>
        }
      />
      <Flash msg={sp.msg} />
      <div className="card mb-5 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link href={`/calendar?m=${month.minus({ months: 1 }).toFormat("yyyy-LL")}`} className="btn-secondary btn-sm" aria-label="Previous month">
            ‹
          </Link>
          <div className="text-center">
            <div className="font-semibold">{month.toFormat("LLLL yyyy")}</div>
            {!month.hasSame(now, "month") && (
              <Link href="/calendar" className="text-xs text-accent">
                Today
              </Link>
            )}
          </div>
          <Link href={`/calendar?m=${month.plus({ months: 1 }).toFormat("yyyy-LL")}`} className="btn-secondary btn-sm" aria-label="Next month">
            ›
          </Link>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {days.map((d) => {
            const list = byDay.get(d.toISODate()!) ?? [];
            const inMonth = d.hasSame(month, "month");
            const today = d.hasSame(now, "day");
            return (
              <div key={d.toISODate()} className={`min-h-14 p-1 sm:min-h-24 ${inMonth ? "bg-surface" : "bg-surface-2/60"}`}>
                <div className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? "bg-primary font-bold text-primary-text" : inMonth ? "" : "text-muted"}`}>{d.day}</div>
                <div className="hidden space-y-0.5 sm:block">
                  {list.slice(0, 3).map((e) => (
                    <Link key={e.id} href={`/calendar/${e.id}`} className={`block truncate rounded px-1 text-[11px] ${e.presidency_only ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}>
                      {formatTime(e.starts_at, tz)} {e.title}
                    </Link>
                  ))}
                  {list.length > 3 && <div className="px-1 text-[10px] text-muted">+{list.length - 3} more</div>}
                </div>
                <div className="flex flex-wrap gap-0.5 sm:hidden">
                  {list.map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.presidency_only ? "bg-warn" : "bg-accent"}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="h2 mb-2">{month.hasSame(now, "month") ? "Coming up this month" : `Events in ${month.toFormat("LLLL")}`}</h2>
      {upcoming.length === 0 ? (
        <Empty>No events.</Empty>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <li key={e.id}>
              <Link href={`/calendar/${e.id}`} className="card flex items-center gap-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {e.title} {e.presidency_only ? <Badge tone="warn">Presidency only</Badge> : null}
                  </div>
                  <div className="text-sm text-muted">
                    {formatDateTime(e.starts_at, tz)}
                    {e.location && ` · ${e.location}`}
                  </div>
                </div>
                <span className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
