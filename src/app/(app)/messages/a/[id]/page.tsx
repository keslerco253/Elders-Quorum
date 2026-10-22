import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ledOrgIds } from "@/lib/conversations";
import { openAnnouncement } from "@/lib/member-inbox";
import { getOrg, orgLabel } from "@/lib/orgs";
import { formatDateTime } from "@/lib/time";
import { leadersWord } from "@/lib/types";
import { Linkify } from "@/components/linkify";
import { FlyerView } from "@/components/flyer-view";
import { ChatBox } from "@/components/chat-box";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { sendInThread } from "../../actions";
import { orgTakesMessages } from "@/lib/message-routing";

export const metadata = { title: "Message" };

const LINK_LABELS: Record<string, string> = { "/lessons": "Lessons", "/calendar": "Calendar", "/plans": "Plans", "/signups": "Service" };

/** One message an organization sent (to everyone, a group, ...), with a private reply to its leaders. */
export default async function AnnouncementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const a = openAnnouncement(user.id, Number(id));
  if (!a) notFound();
  const org = getOrg(a.org_id)!;
  const leaders = leadersWord(org);
  const mine = a.sender_id === user.id;
  const back = ledOrgIds(user.id).length ? "/messages?tab=mine" : "/messages";
  return (
    <>
      <PageHeader title={a.title} back={{ href: back, label: "Messages" }} subtitle={[a.sender_name && `From ${a.sender_name}`, orgLabel(org), `To ${a.audience_label}`].filter(Boolean).join(" · ")} />
      <article className="card mb-5 space-y-3">
        <div className="text-xs text-muted">{formatDateTime(a.created_at, user.ward.timezone, "cccc, LLL d 'at' h:mm a")}</div>
        <p className="whitespace-pre-wrap break-words">
          <Linkify text={a.body} />
        </p>
        {a.flyer_file && <FlyerView file={a.flyer_file} name={a.flyer_name} className="pt-1" />}
        {LINK_LABELS[a.link] && (
          <Link href={a.link} className="btn-secondary btn-sm">
            Open {LINK_LABELS[a.link]}
          </Link>
        )}
      </article>
      {!mine && orgTakesMessages(a.org_id, user.id) && (
        <>
          <Flash msg={sp.msg} tone="warn" />
          <form action={sendInThread} className="card space-y-3">
            <input type="hidden" name="org_id" value={a.org_id} />
            <input type="hidden" name="with" value={0} />
            <input type="hidden" name="message_id" value={a.id} />
            <label className="label" htmlFor="body">
              Reply to the {leaders}
            </label>
            <ChatBox id="body" name="body" rows={3} maxLength={1000} required className="input" draftKey={`re:${a.id}`} placeholder="Write your reply… (Ctrl+Enter to send)" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">Only the {leaders} sees your reply, not everyone who got this message.</span>
              <SubmitButton pendingText="Sending…">Send reply</SubmitButton>
            </div>
          </form>
        </>
      )}
    </>
  );
}
