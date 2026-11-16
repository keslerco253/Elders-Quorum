import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { videoLinkFor } from "@/lib/meetings";
import { PageHeader } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Join the meeting" };

/** "Join" in a video-meeting invitation: opens the meeting, for the presidency and whoever was invited. */
export default async function JoinMeetingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const orgId = Number((await searchParams).org) || user.org_id;
  const link = videoLinkFor(orgId, user.id);
  if (link) redirect(link);
  return (
    <>
      <PageHeader title="Join the meeting" />
      <div className="card max-w-xl space-y-2 text-sm">
        <p>This meeting&apos;s link isn&apos;t open to you right now. An invitation lasts 12 hours, and the link may have changed.</p>
        <p className="text-muted">Ask whoever invited you to send it again.</p>
        <Link href="/" className="btn-secondary btn-sm inline-block">
          Home
        </Link>
      </div>
    </>
  );
}
