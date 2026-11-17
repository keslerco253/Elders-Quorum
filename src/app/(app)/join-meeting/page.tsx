import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { JOIN_EARLY_MIN, meetingById, meetingVideoLink, meetingVideoLinkFor, videoLinkFor } from "@/lib/meetings";
import { getOrg, getWard } from "@/lib/orgs";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { DateTime } from "luxon";

export const metadata = { title: "Join the meeting" };

/**
 * "Join" from a video meeting: a scheduled one (?meeting=, for its presidency or the
 * people invited, around its time), or one started just now (?org=, for the presidency
 * and whoever was invited in the last 12 hours).
 */
export default async function JoinMeetingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  let why = "This meeting's link isn't open to you right now. An invitation lasts 12 hours, and the link may have changed.";
  const meeting = Number(sp.meeting) ? meetingById(Number(sp.meeting)) : undefined;
  if (meeting) {
    const tz = getWard(getOrg(meeting.org_id)?.ward_id ?? 0)?.timezone || "America/Boise";
    const link = meetingVideoLinkFor(meeting, user.id, tz);
    if (link) redirect(link);
    if (!meetingVideoLink(meeting)) why = "This meeting isn't being held over video any more.";
    else if (meeting.time) {
      const start = DateTime.fromISO(`${meeting.date}T${meeting.time}`, { zone: tz });
      if (DateTime.utc() < start.minus({ minutes: JOIN_EARLY_MIN }))
        why = `It opens an hour before the meeting: ${formatDate(meeting.date, "short")} at ${start.toFormat("h:mm a")}. Come back then.`;
    }
  } else {
    const link = videoLinkFor(Number(sp.org) || user.org_id, user.id);
    if (link) redirect(link);
  }
  return (
    <>
      <PageHeader title="Join the meeting" />
      <div className="card max-w-xl space-y-2 text-sm">
        <p>{why}</p>
        <p className="text-muted">If you think you should be in it, ask whoever invited you.</p>
        {meeting?.event_id && (
          <Link href={`/calendar/${meeting.event_id}`} className="link block">
            See the meeting
          </Link>
        )}
        <Link href="/" className="btn-secondary btn-sm inline-block">
          Home
        </Link>
      </div>
    </>
  );
}
