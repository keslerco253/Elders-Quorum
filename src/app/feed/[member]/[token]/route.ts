import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { eventsBetween, icsFeed, parseAlerts, validFeedToken } from "@/lib/events";
import { memberWards } from "@/lib/orgs";
import { personalEventsBetween } from "@/lib/personal-events";
import { feedContents, type Member } from "@/lib/types";

// A member's subscribed calendar (Apple Calendar, Google Calendar, Outlook).
// Calendar apps fetch this on their own, so it uses the link's private token,
// not a sign-in. It has the ward-wide events and those of the organizations the
// member belongs to, in every ward they're in, and their own events (only in their
// own feed). Leaders-only events are included only for that organization's leaders.
export async function GET(_req: Request, { params }: { params: Promise<{ member: string; token: string }> }) {
  const p = await params;
  const member = db().prepare("SELECT * FROM members WHERE id = ? AND status = 'active'").get(Number(p.member)) as Member | undefined;
  if (!member || !validFeedToken(member, p.token.replace(/\.ics$/, ""))) return new Response("This calendar link is no longer valid.", { status: 404 });
  const wards = memberWards(member.id);
  const now = DateTime.utc();
  const from = now.minus({ days: 60 }).toISO()!;
  const to = now.plus({ years: 1 }).toISO()!;
  // Ward and organization events, their own events, or both (their choice on Subscribe).
  const which = feedContents(member);
  const events = [
    ...(which !== "personal" ? eventsBetween(member.id, from, to, { joinedOnly: true }) : []),
    ...(which !== "ward" ? personalEventsBetween(member.id, from, to) : []),
  ];
  const name = which === "personal" ? "My events" : wards.length === 1 ? wards[0].name : "My Ward Link";
  return new Response(icsFeed(events, name, wards[0]?.timezone ?? "America/Boise", parseAlerts(member.calendar_alerts)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="ward-calendar.ics"',
      "cache-control": "private, no-store",
    },
  });
}
