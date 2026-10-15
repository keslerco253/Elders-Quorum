import Link from "next/link";
import { Linkify } from "@/components/linkify";
import { requireUser } from "@/lib/auth";
import { contactLabel, inbox, ledOrgIds, leaderUnread, markAnswersRead, memberConversation, orgsWithUnreadAnswers, presidencyContacts, unreadAnswers } from "@/lib/conversations";
import { LeaderInbox } from "./leader-inbox";
import { ChatBox } from "@/components/chat-box";
import { LiveRefresh } from "@/components/live-refresh";
import { leadersWord, roleLabel } from "@/lib/types";
import { formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { replyToPresidency, sendToGroup } from "./actions";
import { sendableGroups } from "@/lib/groups";
import { isAdmin, isPresidency } from "@/lib/permissions";
import { orgRoster } from "@/lib/orgs";

export const metadata = { title: "Messages" };

const LINK_LABELS: Record<string, string> = { "/lessons": "Lessons", "/calendar": "Calendar", "/plans": "Plans", "/signups": "Service" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  // Leaders get an inbox of everyone writing to them, plus their own conversation as a member.
  const leads = ledOrgIds(user.id).length > 0;
  // Replying to a message, or a link to their own conversation, opens My messages.
  const showInbox = leads && sp.tab !== "mine" && !sp.re && !sp.to;
  const tabs = leads && (
    <div className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
      {[
        [true, "/messages", `Inbox${leaderUnread(user.id) ? ` (${leaderUnread(user.id)})` : ""}`],
        [false, "/messages?tab=mine", `My messages${unreadAnswers(user.id) ? ` (${unreadAnswers(user.id)})` : ""}`],
      ].map(([inboxTab, href, label]) => (
        <Link key={String(href)} href={String(href)} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${showInbox === inboxTab ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
  if (showInbox) {
    return (
      <>
        <PageHeader title="Messages" subtitle="Everyone writing to you, in every organization you lead. Tap a conversation to open it." />
        {tabs}
        <LeaderInbox viewerId={user.id} tz={tz} unreadOnly={sp.show === "unread"} q={sp.q ?? ""} />
        {isPresidency(user) && (
          <Section title="New message">
            <form action="/admin/replies" className="card flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="to">
                  To someone in {user.orgLabel}
                </label>
                <select id="to" name="to" required className="input" defaultValue="">
                  <option value="">Choose a member…</option>
                  {orgRoster(user.org_id)
                    .filter((m) => m.id !== user.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                </select>
              </div>
              <button className="btn-secondary">Open conversation</button>
            </form>
          </Section>
        )}
      </>
    );
  }
  const messages = inbox(user.id, user.org_id);
  const leaders = leadersWord(user.org);
  const replyingTo = messages.find((m) => m.id === Number(sp.re));
  const thread = memberConversation(user.id, user.org_id);
  markAnswersRead(user.id, user.org_id);
  const elsewhere = orgsWithUnreadAnswers(user.id).filter((id) => id !== user.org_id);
  const contacts = presidencyContacts(user.org_id);
  // Leaders send to groups from Admin → Send a message.
  const myGroups = isAdmin(user) ? [] : sendableGroups(user);
  // Default "Send to": whoever they asked for, else keep a private conversation private.
  const last = thread[thread.length - 1];
  const lastMine = thread.findLastIndex((c) => c.direction === "in");
  const wanted = Number(sp.to) || (!replyingTo && last?.recipient_id) || 0;
  const defaultTo = contacts.some((c) => c.id === wanted) ? wanted : 0;

  return (
    <>
      <PageHeader title="Messages" subtitle={`Messages from ${user.orgLabel}, and your private conversation with its ${leaders}.`} />
      {tabs}
      {elsewhere.length > 0 && (
        <p className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
          New messages in{" "}
          {elsewhere.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <a className="link font-semibold" href={`/messages?tab=mine&org=${id}`}>
                {user.orgs.find((o) => o.id === id)?.label ?? "another ward"}
              </a>
            </span>
          ))}
          .
        </p>
      )}

      <div id="conversation" className="scroll-mt-20">
        <Section title={`You and the ${leaders}`}>
          <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />
          {thread.length > 0 && (
            <ul className="mb-3 space-y-2">
              {thread.map((c, i) => (
                <li key={c.id} className={`flex flex-wrap ${c.direction === "in" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${c.direction === "in" ? "bg-primary text-primary-text" : "border border-border bg-surface"}`}>
                    {c.recipient_id && <div className="mb-0.5 text-xs font-semibold opacity-80">🔒 Private {c.direction === "in" ? `to ${c.recipient_name}` : ""}</div>}
                    {c.message_title && <div className="mb-0.5 text-xs opacity-80">Re: {c.message_title}</div>}
                    <div className="whitespace-pre-wrap break-words">
                  <Linkify text={c.body} />
                </div>
                    <div className="mt-1 text-[11px] opacity-70">
                      {c.direction === "out" ? `${c.author_name ?? roleLabel("presidency", user.org)} · ` : c.via === "text" ? "You, by text · " : ""}
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
          <LiveRefresh seconds={15} />
          {isAdmin(user) && (
            <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              This is for writing to the {leaders} as a member. To send to everyone, or to one of your message groups, use{" "}
              <Link href="/admin/messages" className="link">
                Admin → Send a message
              </Link>
              .
            </p>
          )}
          <form action={replyToPresidency} className="card space-y-3">
            {replyingTo && (
              <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted">Replying to</span>
                  <Link href="/messages?tab=mine#conversation" className="text-xs text-accent">
                    Clear
                  </Link>
                </div>
                <div className="font-medium">{replyingTo.title}</div>
                <div className="line-clamp-2 text-muted">{replyingTo.body}</div>
                <input type="hidden" name="message_id" value={replyingTo.id} />
              </div>
            )}
            <div>
              <label className="label" htmlFor="to">
                Send to
              </label>
              <select id="to" name="to" className="input" defaultValue={defaultTo}>
                <option value={0}>The whole {leaders}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    Only {contactLabel(c, user.org)}
                  </option>
                ))}
              </select>
              <p className="hint">Choose one person to keep it private: the rest of the {leaders} won&apos;t see it.</p>
            </div>
            <label className="label" htmlFor="body">
              {replyingTo ? "Your reply" : "Message"}
            </label>
            <ChatBox
              id="body"
              name="body"
              rows={3}
              maxLength={1000}
              required
              className="input"
              autoFocus={!!replyingTo}
              draftKey={`mine:${user.org_id}`}
              placeholder="Write your message… (Ctrl+Enter to send)"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">Only the person or people you chose will see this.</span>
              <SubmitButton pendingText="Sending…">Send</SubmitButton>
            </div>
          </form>
        </Section>
      </div>

      {myGroups.length > 0 && (
        <div id="group-message" className="scroll-mt-20">
          <Section title="Message a group">
            <Flash msg={sp.gmsg} tone={sp.ok ? "success" : "warn"} />
            <form action={sendToGroup} className="card max-w-2xl space-y-3">
              <div>
                <label className="label" htmlFor="group_id">
                  Send to
                </label>
                <select id="group_id" name="group_id" className="input">
                  {myGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="label" htmlFor="group-body">
                Message
              </label>
              <textarea id="group-body" name="body" rows={3} maxLength={1000} required className="input" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">Everyone in the group gets it, signed with your name. Replies go to the {leaders}.</span>
                <SubmitButton pendingText="Sending…" confirm="Send this to the whole group?">
                  Send to group
                </SubmitButton>
              </div>
            </form>
          </Section>
        </div>
      )}

      <Section title={`From ${user.orgLabel}`}>
        {messages.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className={`card space-y-1 ${m.id === replyingTo?.id ? "ring-2 ring-accent" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{m.title}</span>
                  <span className="text-xs text-muted">{formatDateTime(m.created_at, tz, "LLL d")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                {m.sender_name && <div className="text-xs text-muted">From {m.sender_name}</div>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/messages?tab=mine&re=${m.id}#conversation`} className="btn-secondary btn-sm">
                    Reply
                  </Link>
                  {LINK_LABELS[m.link] && (
                    <Link href={m.link} className="btn-secondary btn-sm">
                      Open {LINK_LABELS[m.link]}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
