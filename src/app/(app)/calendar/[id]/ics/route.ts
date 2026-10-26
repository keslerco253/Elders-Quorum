import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEvent, icsFor, isAppleMobile, parseAlerts, validIcsToken } from "@/lib/events";
import type { Member } from "@/lib/types";

/** The signed-in member, or the member named in the link's private token (iPhone opens it outside the app). */
async function whoIsAsking(req: Request, eventId: number): Promise<Member | null> {
  const user = await getUser();
  if (user) return user;
  const url = new URL(req.url);
  const memberId = Number(url.searchParams.get("m"));
  if (!memberId || !validIcsToken(eventId, memberId, url.searchParams.get("t") ?? "")) return null;
  return (db().prepare("SELECT * FROM members WHERE id = ? AND status = 'active'").get(memberId) as Member | undefined) ?? null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await whoIsAsking(req, id);
  if (!user) return new Response("This calendar link has expired. Open the event in the app and try again.", { status: 401 });
  // Still checks the member may see the event (presidency-only events stay private).
  const e = getEvent(user.id, id);
  if (!e) return new Response("Not found", { status: 404 });
  // In the event's ward's time zone (for an all-day event's dates).
  const tz = (db().prepare("SELECT w.timezone FROM orgs o JOIN wards w ON w.id = o.ward_id WHERE o.id = ?").get(e.org_id) as { timezone: string } | undefined)?.timezone;
  return new Response(icsFor(e, parseAlerts(user.calendar_alerts), undefined, tz), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // iPhones and iPads only offer "Add to Calendar" when the file is shown, not downloaded.
      "content-disposition": `${isAppleMobile(req.headers.get("user-agent")) ? "inline" : "attachment"}; filename="event-${e.id}.ics"`,
    },
  });
}
