import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { eventsBetween, icsFeed, parseAlerts, validFeedToken } from "@/lib/events";
import type { CurrentUser, Member, Ward } from "@/lib/types";

// A member's subscribed calendar (Apple Calendar, Google Calendar, Outlook).
// Calendar apps fetch this on their own, so it uses the link's private token,
// not a sign-in. Presidency-only events are included only for admins.
export async function GET(_req: Request, { params }: { params: Promise<{ member: string; token: string }> }) {
  const p = await params;
  const member = db().prepare("SELECT * FROM members WHERE id = ? AND status = 'active'").get(Number(p.member)) as Member | undefined;
  if (!member || !validFeedToken(member, p.token.replace(/\.ics$/, ""))) return new Response("This calendar link is no longer valid.", { status: 404 });
  const ward = db().prepare("SELECT id, name, timezone, join_code FROM wards WHERE id = ?").get(member.ward_id) as Ward;
  const user: CurrentUser = { ...member, ward };
  const now = DateTime.utc();
  const events = eventsBetween(user, now.minus({ days: 60 }).toISO()!, now.plus({ years: 1 }).toISO()!);
  return new Response(icsFeed(events, ward.name, ward.timezone, parseAlerts(member.calendar_alerts)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="quorum-calendar.ics"',
      "cache-control": "no-cache",
    },
  });
}
