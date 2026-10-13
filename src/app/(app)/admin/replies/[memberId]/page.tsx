import { notFound } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversation, markRead } from "@/lib/conversations";
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
  const member = db().prepare("SELECT id, display_name, phone, email, contact_pref FROM members WHERE id = ? AND ward_id = ?").get(memberId, user.ward_id) as
    | { id: number; display_name: string; phone: string | null; email: string | null; contact_pref: string }
    | undefined;
  if (!member) notFound();
  const tz = user.ward.timezone;
  const thread = conversation(member.id);
  markRead(member.id, "in");

  return (
    <>
      <PageHeader
        title={member.display_name}
        back={{ href: "/admin/replies", label: "Replies" }}
        subtitle={[member.phone && formatPhone(member.phone), member.email].filter(Boolean).join(" · ") || undefined}
      />
      {thread.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No messages yet. Anything you send here goes to {member.display_name.split(" ")[0]} privately.</p>
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
        <label className="label" htmlFor="body">
          Reply to {member.display_name.split(" ")[0]}
        </label>
        <textarea id="body" name="body" rows={3} maxLength={1000} required className="input" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            Sent as a notification{member.contact_pref !== "none" ? `, or by ${member.contact_pref === "both" ? "text and email" : member.contact_pref} if notifications are off` : ""}. Signed with your name.
          </span>
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
        </div>
      </form>
    </>
  );
}
