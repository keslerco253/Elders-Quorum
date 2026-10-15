import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ledOrgIds, presidencyContacts } from "@/lib/conversations";
import { openMemberThread } from "@/lib/member-inbox";
import { formatDateTime } from "@/lib/time";
import { firstName } from "@/lib/names";
import { leadersWord } from "@/lib/types";
import { myOrgs } from "@/lib/orgs";
import { Linkify } from "@/components/linkify";
import { ChatBox } from "@/components/chat-box";
import { LiveRefresh } from "@/components/live-refresh";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { sendInThread } from "../../actions";

export const metadata = { title: "Conversation" };

/** A member's conversation with their leaders (all of them, or one privately), like a text thread. */
export default async function MemberThreadPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { key } = await params;
  const sp = await searchParams;
  const tz = user.ward.timezone;
  // The link names the organization (it may not be the one they're looking at).
  const org = myOrgs(user.id).find((o) => o.id === Number(sp.org)) ?? { ...user.org, label: user.orgLabel };
  const orgId = org.id;
  const withId = key === "all" ? null : Number(key);
  if (withId !== null && !(withId > 0)) notFound();
  const leaders = leadersWord(org);
  const thread = openMemberThread(user.id, orgId, withId);
  const contact = withId ? presidencyContacts(orgId).find((c) => c.id === withId) : undefined;
  const name = contact?.display_name ?? thread.find((c) => c.recipient_name)?.recipient_name;
  if (withId && !name) notFound();
  const lastMine = thread.findLastIndex((c) => c.direction === "in");
  const back = ledOrgIds(user.id).length ? "/messages?tab=mine" : "/messages";
  return (
    <>
      <PageHeader
        title={withId ? `🔒 ${name}` : `${org.label} ${leaders}`}
        back={{ href: back, label: "Messages" }}
        subtitle={withId ? `Private: only ${firstName(name!)} sees this, not the rest of the ${leaders}.` : `Everyone in the ${leaders} sees this conversation.`}
      />
      {thread.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No messages yet. Write below to start the conversation.</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {thread.map((c, i) => (
            <li key={c.id} className={`flex flex-wrap ${c.direction === "in" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${c.direction === "in" ? "bg-primary text-primary-text" : "border border-border bg-surface"}`}>
                {c.message_title && <div className="mb-0.5 text-xs opacity-80">Re: {c.message_title}</div>}
                <div className="whitespace-pre-wrap break-words">
                  <Linkify text={c.body} />
                </div>
                <div className="mt-1 text-[11px] opacity-70">
                  {c.direction === "out" ? `${c.author_name ?? leaders} · ` : c.via === "text" ? "You, by text · " : ""}
                  {formatDateTime(c.created_at, tz, "LLL d, h:mm a")}
                </div>
              </div>
              {/* Under their newest message: whether a leader has seen it. */}
              {c.direction === "in" && i === lastMine && (
                <div className="w-full pr-1 text-right text-[11px] text-muted">{c.read_at ? `Seen ${formatDateTime(c.read_at, tz, "LLL d, h:mm a")}` : "Delivered"}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div id="end" className="scroll-mt-20" />
      <LiveRefresh seconds={15} />
      <Flash msg={sp.msg} tone="warn" />
      <form action={sendInThread} className="card space-y-3">
        <input type="hidden" name="org_id" value={orgId} />
        <input type="hidden" name="with" value={withId ?? 0} />
        <ChatBox
          id="body"
          name="body"
          rows={3}
          maxLength={1000}
          required
          className="input"
          aria-label="Message"
          draftKey={`thread:${orgId}:${key}`}
          placeholder={`Message ${withId ? firstName(name!) : `the ${leaders}`}… (Ctrl+Enter to send)`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">{withId ? `Only ${firstName(name!)} will see this.` : `Everyone in the ${leaders} will see this.`}</span>
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
        </div>
      </form>
    </>
  );
}
