import Link from "next/link";
import { Linkify } from "@/components/linkify";
import { notFound } from "next/navigation";
import { firstName } from "@/lib/names";
import { requirePresidency } from "@/lib/auth";
import { ForwardForm } from "@/components/forward-form";
import { forwardTargets } from "@/lib/message-routing";
import { forwardMemberMessage } from "../../../pass-on/actions";
import { db } from "@/lib/db";
import { conversation, markThreadRead, type Thread } from "@/lib/conversations";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { ChatBox } from "@/components/chat-box";
import { LiveRefresh } from "@/components/live-refresh";
import { answerMember, markUnread } from "../actions";
import { leadersWord } from "@/lib/types";
import { hasFeature } from "@/lib/orgs";
import { agendaFromMessage } from "../../meetings/actions";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const memberId = Number((await params).memberId);
  const member = db().prepare("SELECT m.id, m.display_name, m.phone, m.email, m.contact_pref FROM members m JOIN ward_members wm ON wm.member_id = m.id AND wm.ward_id = ? WHERE m.id = ?").get(user.ward_id, memberId) as
    | { id: number; display_name: string; phone: string | null; email: string | null; contact_pref: string }
    | undefined;
  if (!member) notFound();
  const tz = user.ward.timezone;
  const privately = sp.private === "1";
  const which: Thread = privately ? { private: true, withId: user.id } : { private: false };
  const thread = conversation(user.org_id, member.id, which);
  markThreadRead(user.org_id, member.id, which, user.id);
  const unreadOther = (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM member_messages m WHERE m.org_id = ? AND m.member_id = ? AND m.direction = 'in' AND ${privately ? "m.recipient_id IS NULL" : "m.recipient_id = ?"}
           AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.viewer_id = ?)`,
      )
      .get(...(privately ? [user.org_id, member.id, user.id] : [user.org_id, member.id, user.id, user.id])) as { n: number }
  ).n;
  const first = firstName(member.display_name);
  // Other organizations (and leaders) a message can be forwarded to.
  const forwardTo = forwardTargets(user.ward_id).filter((t) => !t.value.startsWith(`org:${user.org_id}`) && !t.value.startsWith(`leader:${user.org_id}:`));
  const lastOut = thread.findLastIndex((c) => c.direction === "out");
  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2"}`;

  return (
    <>
      <PageHeader
        title={member.display_name}
        back={{ href: "/messages", label: "Messages" }}
        subtitle={[user.orgLabel !== user.ward.name ? `${user.ward.name} · ${user.orgLabel}` : user.ward.name, member.phone && formatPhone(member.phone), member.email].filter(Boolean).join(" · ")}
      />
      <div className="mb-4 flex gap-2">
        <Link href={`/admin/replies/${member.id}`} className={tab(!privately)}>
          Whole presidency{!privately ? "" : unreadOther ? ` (${unreadOther})` : ""}
        </Link>
        <Link href={`/admin/replies/${member.id}?private=1`} className={tab(privately)}>
          Private with you{privately ? "" : unreadOther ? ` (${unreadOther})` : ""}
        </Link>
      </div>
      {thread.some((c) => c.direction === "in") && (
        <form action={markUnread} className="-mt-2 mb-3 text-right">
          <input type="hidden" name="member_id" value={member.id} />
          <input type="hidden" name="org_id" value={user.org_id} />
          {privately && <input type="hidden" name="private" value="1" />}
          <button className="text-xs text-accent hover:underline">Mark as unread</button>
        </form>
      )}
      <p className="mb-4 text-xs text-muted">
        {privately
          ? `Only you and ${first} see this conversation. Other presidency members can't.`
          : `Everyone in the presidency sees this conversation.`}
      </p>
      {thread.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No messages yet. Anything you send here goes to {first}{privately ? ", privately from you" : ""}.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {thread.map((c, i) => (
            <li key={c.id} className={`flex flex-wrap ${c.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${c.direction === "out" ? "bg-primary text-primary-text" : "border border-border bg-surface"}`}>
                {c.message_title && <div className="mb-0.5 text-xs opacity-80">Re: {c.message_title}</div>}
                <div className="whitespace-pre-wrap break-words">
                  <Linkify text={c.body} />
                </div>
                <div className="mt-1 text-[11px] opacity-70">
                  {c.direction === "out" ? `${c.author_name ?? "Presidency"} · ` : c.via === "text" ? "By text · " : "In the app · "}
                  {formatDateTime(c.created_at, tz, "LLL d, h:mm a")}
                </div>
                {c.note && <div className="mt-0.5 text-[11px] italic opacity-80">{c.note}</div>}
                {/* Meant for someone else? Send it on. */}
                {c.direction === "in" && (
                  <ForwardForm messageId={c.id} targets={forwardTo} action={forwardMemberMessage} back={`/admin/replies/${member.id}${privately ? "?private=1" : ""}`} />
                )}
                {c.direction === "in" && hasFeature(user.org, "todos") && (
                  <form action={agendaFromMessage} className="mt-1">
                    <input type="hidden" name="message_id" value={c.id} />
                    <input type="hidden" name="back" value={`/admin/replies/${member.id}${privately ? "?private=1" : ""}`} />
                    <button className="text-[11px] text-accent hover:underline">+ Add to the next presidency meeting</button>
                  </form>
                )}
              </div>
              {/* Like a read receipt: under the newest answer, whether they've seen it. */}
              {c.direction === "out" && i === lastOut && (
                <div className="w-full pr-1 text-right text-[11px] text-muted">{c.read_at ? `Seen ${formatDateTime(c.read_at, tz, "LLL d, h:mm a")}` : "Delivered"}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div id="end" className="scroll-mt-20" />
      <LiveRefresh seconds={10} />
      <Flash msg={sp.msg} tone={sp.err ? "warn" : "success"} />
      <form action={answerMember} className="card space-y-3">
        <input type="hidden" name="member_id" value={member.id} />
          <input type="hidden" name="org_id" value={user.org_id} />
        {privately && <input type="hidden" name="private" value="1" />}
        <label className="label" htmlFor="body">
          {privately ? `Private reply to ${first}` : thread.length ? `Reply to ${first}` : `Personal message to ${first}`}
        </label>
        <ChatBox id="body" name="body" rows={3} maxLength={1000} required className="input" draftKey={`reply:${user.org_id}:${member.id}:${privately ? "p" : "all"}`} placeholder={`Message ${first}… (Ctrl+Enter to send)`} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            {privately
              ? `Sent just to them, like any personal message (your words, signed "- ${user.display_name}"). Only you can see it here.`
              : `Sent as a notification${member.contact_pref !== "none" ? `, or by ${member.contact_pref === "both" ? "text and email" : member.contact_pref} if notifications are off` : ""}: just your words, signed "- ${user.display_name}", with no header or link. The rest of the ${leadersWord(user.org)} can see it here.`}
          </span>
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
        </div>
      </form>
    </>
  );
}
