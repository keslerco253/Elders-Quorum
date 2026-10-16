import Link from "next/link";
import { redirect } from "next/navigation";
import { Linkify } from "@/components/linkify";
import { FlyerThumb } from "@/components/flyer-thumb";
import { requireUser } from "@/lib/auth";
import { ledOrgIds, leaderUnread, unreadAnswers } from "@/lib/conversations";
import { unreadAnnouncements } from "@/lib/member-inbox";
import { LeaderInbox } from "./leader-inbox";
import { MemberInboxList, MemberSentList } from "./member-inbox-list";
import { leadersWord } from "@/lib/types";
import { formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { sentAnnouncements } from "@/lib/compose";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  // Leaders get an inbox of everyone writing to them, plus their own conversation as a member.
  const leads = ledOrgIds(user.id).length > 0;
  // Links in older notifications.
  if (sp.re) redirect(`/messages/a/${Number(sp.re)}`);
  if (sp.to) redirect(`/messages/new?as=member&to=${encodeURIComponent(`p:${user.org_id}:${Number(sp.to) || 0}`)}`);
    const tab = !leads || sp.tab === "mine" ? "mine" : sp.tab === "sent" ? "sent" : "inbox";
  const newButton = leads && (
    <Link href="/messages/new" className="btn-primary">
      ✎ New message
    </Link>
  );
  const tabs = leads && (
    <div className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
      {[
        ["inbox", "/messages", `Inbox${leaderUnread(user.id) ? ` (${leaderUnread(user.id)})` : ""}`],
        ["sent", "/messages?tab=sent", "Sent"],
        ["mine", "/messages?tab=mine", `My messages${unreadAnswers(user.id) + unreadAnnouncements(user.id) ? ` (${unreadAnswers(user.id) + unreadAnnouncements(user.id)})` : ""}`],
      ].map(([key, href, label]) => (
        <Link key={key} href={href} className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${tab === key ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
  if (tab === "inbox") {
    return (
      <>
        <PageHeader title="Messages" subtitle="Everyone writing to you, in every organization you lead. Tap a conversation to open it." actions={newButton} />
        {tabs}
        <Flash msg={sp.msg} tone="success" />
        <LeaderInbox viewerId={user.id} tz={tz} unreadOnly={sp.show === "unread"} q={sp.q ?? ""} />
      </>
    );
  }
  if (tab === "sent") {
    const sent = sentAnnouncements(user.id);
    const manyOrgs = new Set(ledOrgIds(user.id)).size > 1;
    return (
      <>
        <PageHeader title="Messages" subtitle="Announcements sent to groups in the organizations you lead." actions={newButton} />
        {tabs}
        <Flash msg={sp.msg} tone="success" />
        {sent.length === 0 ? (
          <Empty>Nothing sent yet. Use New message to write to everyone, the {leadersWord(user.org)}, or a group.</Empty>
        ) : (
          <ul className="space-y-2">
            {sent.map((m) => (
              <li key={m.id} className="card space-y-1">
                {m.flyer_file && (
                  <div className="float-right ml-3">
                    <FlyerThumb file={m.flyer_file} name={m.flyer_name} />
                  </div>
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{m.title}</span>
                  <span className="text-xs text-muted">{formatDateTime(m.created_at, tz, "LLL d, h:mm a")}</span>
                </div>
                <div className="text-xs text-muted">
                  To {m.audience_label}
                  {manyOrgs && ` · ${m.org_label}`}
                  {m.sender && ` · from ${m.sender}`}
                </div>
                {m.body !== m.title && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    <Linkify text={m.body} />
                  </p>
                )}
                <div className="text-xs text-muted">
                  {m.push_count} app · {m.email_count} email · {m.text_count} text
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  // Members (and leaders on My messages): an inbox of conversations and messages, and what they've sent.
  const sentView = sp.view === "sent";
  const base = leads ? "/messages?tab=mine" : "/messages";
  const memberTabs = (
    <div className={leads ? "mb-3 flex gap-2" : "mb-5 flex gap-1 rounded-xl bg-surface-2 p-1"}>
      {[
        [false, base, `Inbox${unreadAnswers(user.id) + unreadAnnouncements(user.id) ? ` (${unreadAnswers(user.id) + unreadAnnouncements(user.id)})` : ""}`],
        [true, `${base}${leads ? "&" : "?"}view=sent`, "Sent"],
      ].map(([sent, href, label]) => (
        <Link
          key={String(href)}
          href={String(href)}
          className={
            leads
              ? `rounded-full px-3 py-1 text-sm font-medium ${sentView === sent ? "bg-primary text-primary-text" : "bg-surface-2 text-muted hover:text-text"}`
              : `flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium ${sentView === sent ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"}`
          }
        >
          {label}
        </Link>
      ))}
    </div>
  );
  const newHref = leads ? "/messages/new?as=member" : "/messages/new";
  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={leads ? `Your own messages, as a member: from your organizations and their leaders.` : `From your organizations, and your conversations with their ${leadersWord(user.org)}.`}
        actions={
          <Link href={newHref} className="btn-primary">
            ✎ New message
          </Link>
        }
      />
      {tabs}
      {memberTabs}
      <Flash msg={sp.msg} tone="success" />
      {sentView ? <MemberSentList memberId={user.id} tz={tz} /> : <MemberInboxList memberId={user.id} tz={tz} newHref={newHref} />}
    </>
  );
}
