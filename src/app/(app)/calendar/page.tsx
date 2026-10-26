import Link from "next/link";
import { RemindersLink } from "@/components/reminders-link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { eventsBetween, isOngoing, spanText } from "@/lib/events";
import { isAdmin } from "@/lib/permissions";
import { formatDateTime, formatTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { hasFeature } from "@/lib/orgs";
import { eventHref, personalEventsBetween } from "@/lib/personal-events";
import type { EventRow } from "@/lib/types";

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
  // One ward calendar; ?o= shows one organization's events.
  const only = user.orgs.find((o) => o.id === Number(sp.o));
  // With the member's own events (only they see them) when showing everything.
  const events = [
    ...eventsBetween(user.id, gridStart.toUTC().toISO()!, gridEnd.toUTC().toISO()!, { wardId: user.ward_id, orgIds: only ? [only.id] : undefined }),
    ...(only ? [] : personalEventsBetween(user.id, gridStart.toUTC().toISO()!, gridEnd.toUTC().toISO()!)),
  ].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const chip = (e: EventRow) => (e.personal_event_id ? "bg-success-soft text-success" : e.presidency_only ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent");
  const keep = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ o: only ? String(only.id) : undefined, ...extra })) if (v) p.set(k, v);
    const qs = p.toString();
    return `/calendar${qs ? `?${qs}` : ""}`;
  };
  // The calendar holds every organization's events, so each says where it's from.
  const showOrg = !only;
  // Events lasting days or months (an open house) show as going on, not on their first day.
  const ongoing = events.filter(isOngoing);
  const monthStart = month.startOf("month").toUTC().toISO()!;
  const monthEnd = month.endOf("month").toUTC().toISO()!;
  const ongoingThisMonth = ongoing.filter((e) => e.starts_at <= monthEnd && e.ends_at >= monthStart);
  const byDay = new Map<string, typeof events>();
  for (const e of events.filter((e) => !isOngoing(e))) {
    const k = DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).toISODate()!;
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days: DateTime[] = [];
  for (let d = gridStart; d <= gridEnd; d = d.plus({ days: 1 })) days.push(d);
  const monthEvents = events.filter((e) => !isOngoing(e) && DateTime.fromISO(e.starts_at, { zone: "utc" }).setZone(tz).hasSame(month, "month"));
  const upcoming = month.hasSame(now, "month") ? monthEvents.filter((e) => e.ends_at >= now.toUTC().toISO()!) : monthEvents;
  const admin = isAdmin(user);
  const dayHref = (d: DateTime) => keep({ m: d.toFormat("yyyy-LL"), d: d.toISODate()! });
  const dayEvents = selected
    ? [
        ...ongoing.filter((e) => e.starts_at <= selected.endOf("day").toUTC().toISO()! && e.ends_at >= selected.startOf("day").toUTC().toISO()!),
        ...(byDay.get(selected.toISODate()!) ?? []),
      ]
    : [];
  const list = selected ? dayEvents : [...ongoingThisMonth, ...upcoming];

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <>
            <Link href="/calendar/mine/new" className="btn-secondary">
              + My event
            </Link>
            <RemindersLink kind="events" />
            <Link href="/calendar/subscribe" className="btn-secondary">
              Subscribe
            </Link>
            {admin && (
              <Link href="/admin/events/new" className="btn-primary">
                Add {user.orgLabel} event
              </Link>
            )}
            {!admin && hasFeature(user.org, "event_requests") && (
              <Link href="/calendar/request" className="btn-secondary">
                Request an event
              </Link>
            )}
          </>
        }
      />
      <Flash msg={sp.msg} />
      {user.orgs.length > 1 && (
        <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Show events for">
          {[{ id: 0, label: "Everything" }, ...user.orgs].map((o) => {
            const on = (only?.id ?? 0) === o.id;
            return (
              <Link
                key={o.id}
                href={o.id ? `/calendar?o=${o.id}${sp.m ? `&m=${sp.m}` : ""}` : `/calendar${sp.m ? `?m=${sp.m}` : ""}`}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap ${on ? "border-primary bg-primary text-primary-text" : "border-border bg-surface hover:bg-surface-2"}`}
              >
                {o.label}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="card mb-5 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link href={keep({ m: month.minus({ months: 1 }).toFormat("yyyy-LL") })} className="btn-secondary btn-sm" aria-label="Previous month">
            ‹
          </Link>
          <div className="text-center">
            <div className="font-semibold">{month.toFormat("LLLL yyyy")}</div>
            {!month.hasSame(now, "month") && (
              <Link href={keep({})} className="text-xs text-accent">
                Today
              </Link>
            )}
          </div>
          <Link href={keep({ m: month.plus({ months: 1 }).toFormat("yyyy-LL") })} className="btn-secondary btn-sm" aria-label="Next month">
            ›
          </Link>
        </div>
        {ongoingThisMonth.length > 0 && (
          <ul className="mb-2 space-y-1">
            {ongoingThisMonth.map((e) => (
              <li key={e.id}>
                <Link href={eventHref(e)} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-accent hover:opacity-90">
                  <span className="font-semibold">Going on: {e.title}</span>
                  <span>{spanText(e, tz)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
                    <Link key={e.id} href={eventHref(e)} className={`block truncate rounded px-1 text-[11px] ${chip(e)}`}>
                      {formatTime(e.starts_at, tz)} {e.title}
                    </Link>
                  ))}
                  {list.length > 3 && <div className="pointer-events-none px-1 text-[10px] text-muted">+{list.length - 3} more</div>}
                </div>
                <div className="pointer-events-none relative flex flex-wrap gap-0.5 sm:hidden">
                  {list.map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.personal_event_id ? "bg-success" : e.presidency_only ? "bg-warn" : "bg-accent"}`} />
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
          <div className="flex flex-wrap gap-2">
            <Link href={`/calendar/mine/new?date=${selected.toISODate()}`} className="btn-secondary btn-sm">
              + My event this day
            </Link>
            {admin && (
              <Link href={`/admin/events/new?date=${selected.toISODate()}`} className="btn-secondary btn-sm">
                Add event on this day
              </Link>
            )}
            <Link href={keep({ m: month.toFormat("yyyy-LL") })} scroll={false} className="btn-secondary btn-sm">
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
              <Link href={eventHref(e)} className="card flex items-center gap-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {e.title}{" "}
                    {e.personal_event_id ? (
                      <Badge tone="success">🔒 Only you</Badge>
                    ) : e.invited_meeting_id ? (
                      <Badge tone="info">Invited</Badge>
                    ) : e.presidency_only ? (
                      <Badge tone="warn">Leaders only</Badge>
                    ) : null}
                    {showOrg && !e.personal_event_id && <Badge>{e.org_label}</Badge>}
                  </div>
                  <div className="text-sm text-muted">
                    {isOngoing(e) ? spanText(e, tz) : selected ? `${formatTime(e.starts_at, tz)} – ${formatTime(e.ends_at, tz)}` : formatDateTime(e.starts_at, tz)}
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
