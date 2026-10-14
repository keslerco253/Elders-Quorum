import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEvent, googleCalendarUrl, icsPath, isAppleMobile } from "@/lib/events";
import { isAdmin } from "@/lib/permissions";
import { formatDateTime, formatTime, parseUtc } from "@/lib/time";
import { getSeries, recurrenceOf } from "@/lib/event-series";
import { describeRecurrence } from "@/lib/recurrence";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { rsvp } from "../actions";
import { roleIn } from "@/lib/orgs";

export const metadata = { title: "Event" };

const LABELS = { yes: "Going", maybe: "Maybe", no: "Can't go" } as const;

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const e = getEvent(user.id, Number(id));
  if (!e) notFound();
  const series = getSeries(e.org_id, e.series_id);
  const tz = user.ward.timezone;
  // Its own organization's leaders can edit it.
  const admin = isAdmin({ role: roleIn(user.id, e.org_id) });
  const sameDay = parseUtc(e.starts_at).setZone(tz).hasSame(parseUtc(e.ends_at).setZone(tz), "day");
  const mine = (db().prepare("SELECT response FROM event_rsvps WHERE event_id = ? AND member_id = ?").get(e.id, user.id) as { response: keyof typeof LABELS } | undefined)?.response;
  const rsvps = e.rsvp_enabled
    ? (db().prepare("SELECT r.response, m.display_name FROM event_rsvps r JOIN members m ON m.id = r.member_id WHERE r.event_id = ? ORDER BY m.display_name").all(e.id) as { response: keyof typeof LABELS; display_name: string }[])
    : [];
  const count = (r: string) => rsvps.filter((x) => x.response === r).length;

  return (
    <>
      <PageHeader
        title={e.title}
        back={{ href: "/calendar", label: "Calendar" }}
        actions={
          admin && (
            <Link href={`/admin/events/${e.id}?org=${e.org_id}`} className="btn-secondary">
              Edit
            </Link>
          )
        }
      />
      <Flash msg={sp.msg} />
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{e.org_label}</Badge>
          {e.presidency_only ? <Badge tone="warn">Leaders only: hidden from members</Badge> : null}
        </div>
        <div>
          <div className="font-semibold">{formatDateTime(e.starts_at, tz, "cccc, LLLL d, yyyy")}</div>
          <div className="text-muted">
            {formatTime(e.starts_at, tz)} – {sameDay ? formatTime(e.ends_at, tz) : formatDateTime(e.ends_at, tz)}
          </div>
          {series && <div className="mt-1 text-sm text-muted">↻ {describeRecurrence(recurrenceOf(series))}</div>}
        </div>
        {e.location && (
          <div>
            <div className="text-sm text-muted">Where</div>
            <a className="link" href={`https://maps.google.com/?q=${encodeURIComponent(e.location)}`} target="_blank" rel="noreferrer">
              {e.location}
            </a>
          </div>
        )}
        {e.description && <p className="whitespace-pre-wrap">{e.description}</p>}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <a href={googleCalendarUrl(e)} target="_blank" rel="noreferrer" className="btn-primary">
            Add to Google Calendar
          </a>
          <a href={icsPath(e.id, user.id)} className="btn-secondary">
            Add to Apple / Outlook calendar
          </a>
        </div>
        {isAppleMobile((await headers()).get("user-agent")) && (
          <p className="text-sm text-muted">On iPhone, tap <strong>Add to Calendar</strong> at the bottom of the event that opens (the check mark at the top only closes it).</p>
        )}
        <p className="text-sm text-muted">
          Want the ward&apos;s events in your calendar automatically?{" "}
          <Link href="/calendar/subscribe" className="link">
            Subscribe to the calendar
          </Link>
        </p>
      </div>

      {!!e.rsvp_enabled && (
        <div className="card mt-4">
          <h2 className="h2 mb-3">Will you be there?</h2>
          <form action={rsvp} className="flex flex-wrap gap-2">
            <input type="hidden" name="event_id" value={e.id} />
            {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((r) => (
              <SubmitButton key={r} name="response" value={r} className={mine === r ? "btn-primary" : "btn-secondary"} pendingText="…">
                {mine === r ? "✓ " : ""}
                {LABELS[r]}
              </SubmitButton>
            ))}
          </form>
          <p className="mt-3 text-sm text-muted">
            {count("yes")} going · {count("maybe")} maybe · {count("no")} can&apos;t go
          </p>
          {admin && rsvps.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              {rsvps.map((r) => (
                <li key={r.display_name}>
                  {r.display_name} <span className="text-muted">· {LABELS[r.response]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
