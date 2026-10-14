import Link from "next/link";
import { notFound } from "next/navigation";
import { firstName } from "@/lib/names";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversation, markThreadRead, type Thread } from "@/lib/conversations";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { answerMember } from "../actions";

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
  markThreadRead(user.org_id, member.id, which);
  const unreadOther = (
    db()
      .prepare(`SELECT COUNT(*) AS n FROM member_messages WHERE org_id = ? AND member_id = ? AND direction = 'in' AND read_at IS NULL AND ${privately ? "recipient_id IS NULL" : "recipient_id = ?"}`)
      .get(...(privately ? [user.org_id, member.id] : [user.org_id, member.id, user.id])) as { n: number }
  ).n;
  const first = firstName(member.display_name);
  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2"}`;

  return (
    <>
      <PageHeader
        title={member.display_name}
        back={{ href: "/admin/replies", label: "Replies" }}
        subtitle={[member.phone && formatPhone(member.phone), member.email].filter(Boolean).join(" · ") || undefined}
      />
      <div className="mb-4 flex gap-2">
        <Link href={`/admin/replies/${member.id}`} className={tab(!privately)}>
          Whole presidency{!privately ? "" : unreadOther ? ` (${unreadOther})` : ""}
        </Link>
        <Link href={`/admin/replies/${member.id}?private=1`} className={tab(privately)}>
          Private with you{privately ? "" : unreadOther ? ` (${unreadOther})` : ""}
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted">
        {privately
          ? `Only you and ${first} see this conversation. Other presidency members can't.`
          : `Everyone in the presidency sees this conversation.`}
      </p>
      {thread.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No messages yet. Anything you send here goes to {first}{privately ? ", privately from you" : ""}.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {thread.map((c) => (
            <li key={c.id} className={`flex ${c.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${c.direction === "out" ? "bg-primary text-primary-text" : "border border-border bg-surface"}`}>
                {c.message_title && <div className="mb-0.5 text-xs opacity-80">Re: {c.message_title}</div>}
                <div className="whitespace-pre-wrap">{c.body}</div>
                <div className="mt-1 text-[11px] opacity-70">
                  {c.direction === "out" ? `${c.author_name ?? "Presidency"} · ` : c.via === "text" ? "By text · " : "In the app · "}
                  {formatDateTime(c.created_at, tz, "LLL d, h:mm a")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div id="end" className="scroll-mt-20" />
      <Flash msg={sp.msg} tone={sp.err ? "warn" : "success"} />
      <form action={answerMember} className="card space-y-3">
        <input type="hidden" name="member_id" value={member.id} />
        {privately && <input type="hidden" name="private" value="1" />}
        <label className="label" htmlFor="body">
          {privately ? `Private reply to ${first}` : `Reply to ${first}`}
        </label>
        <textarea id="body" name="body" rows={3} maxLength={1000} required className="input" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            {privately
              ? "They'll be told they have a private message from you; the words stay in the app."
              : `Sent as a notification${member.contact_pref !== "none" ? `, or by ${member.contact_pref === "both" ? "text and email" : member.contact_pref} if notifications are off` : ""}. Signed with your name.`}
          </span>
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
        </div>
      </form>
    </>
  );
}
