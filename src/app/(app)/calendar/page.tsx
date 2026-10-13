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
  const pickedDay = sp.d ? DateTime.fromISO(sp.d, { zone: tz }) : undefined;
  const selected = pickedDay?.isValid ? pickedDay.startOf("day") : undefined;
  const parsed = sp.m ? DateTime.fromFormat(sp.m, "yyyy-LL", { zone: tz }) : (selected ?? now);
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
  const dayHref = (d: DateTime) => `/calendar?m=${d.toFormat("yyyy-LL")}&d=${d.toISODate()}`;
  const dayEvents = selected ? (byDay.get(selected.toISODate()!) ?? []) : [];
  const list = selected ? dayEvents : upcoming;

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
            const picked = !!selected && d.hasSame(selected, "day");
            return (
              <div key={d.toISODate()} className={`relative min-h-14 p-1 sm:min-h-24 ${picked ? "bg-accent-soft" : inMonth ? "bg-surface hover:bg-surface-2" : "bg-surface-2/60 hover:bg-surface-2"}`}>
                <Link href={dayHref(d)} scroll={false} className="absolute inset-0" aria-label={`Show ${d.toFormat("cccc, LLLL d")}`} aria-current={picked ? "date" : undefined} />
                <div className={`pointer-events-none relative mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? "bg-primary font-bold text-primary-text" : picked ? "font-bold text-accent ring-2 ring-accent" : inMonth ? "" : "text-muted"}`}>{d.day}</div>
                <div className="relative hidden space-y-0.5 sm:block">
                  {list.slice(0, 3).map((e) => (
                    <Link key={e.id} href={`/calendar/${e.id}`} className={`block truncate rounded px-1 text-[11px] ${e.presidency_only ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}>
                      {formatTime(e.starts_at, tz)} {e.title}
                    </Link>
                  ))}
                  {list.length > 3 && <div className="pointer-events-none px-1 text-[10px] text-muted">+{list.length - 3} more</div>}
                </div>
                <div className="pointer-events-none relative flex flex-wrap gap-0.5 sm:hidden">
                  {list.map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.presidency_only ? "bg-warn" : "bg-accent"}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div id="day" className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="h2">{selected ? selected.toFormat("cccc, LLLL d") : month.hasSame(now, "month") ? "Coming up this month" : `Events in ${month.toFormat("LLLL")}`}</h2>
        {selected && (
          <div className="flex gap-2">
            {admin && (
              <Link href={`/admin/events/new?date=${selected.toISODate()}`} className="btn-secondary btn-sm">
                Add event on this day
              </Link>
            )}
            <Link href={`/calendar?m=${month.toFormat("yyyy-LL")}`} scroll={false} className="btn-secondary btn-sm">
              Show whole month
            </Link>
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <Empty>{selected ? "Nothing on the calendar this day." : "No events."}</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/calendar/${e.id}`} className="card flex items-center gap-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {e.title} {e.presidency_only ? <Badge tone="warn">Presidency only</Badge> : null}
                  </div>
                  <div className="text-sm text-muted">
                    {selected ? `${formatTime(e.starts_at, tz)} – ${formatTime(e.ends_at, tz)}` : formatDateTime(e.starts_at, tz)}
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
