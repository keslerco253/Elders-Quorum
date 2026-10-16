import Link from "next/link";
import { OrgLink } from "@/components/org-link";
import { FlyerThumb } from "@/components/flyer-thumb";
import { memberInbox, memberSent } from "@/lib/member-inbox";
import { friendlyTime } from "@/lib/time";
import { firstName } from "@/lib/names";
import { leadersWord } from "@/lib/types";
import { Badge, Empty } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";

const rowClass = (unread: boolean) => `flex items-center gap-3 px-4 py-3 hover:bg-surface-2 ${unread ? "bg-accent-soft/40" : ""}`;

/** A member's inbox, like a phone's messages app: one row per conversation and per message, newest first. */
export function MemberInboxList({ memberId, tz, newHref }: { memberId: number; tz: string; newHref: string }) {
  const rows = memberInbox(memberId);
  const manyOrgs = new Set(rows.map((r) => r.org_id)).size > 1;
  if (rows.length === 0)
    return (
      <Empty>
        No messages yet. To write to your leaders, tap{" "}
        <Link href={newHref} className="link">
          New message
        </Link>
        .
      </Empty>
    );
  return (
    <>
      <LiveRefresh seconds={30} />
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {rows.map((r) => {
          const unread = r.unread > 0;
          const leaders = leadersWord({ kind: r.org_kind });
          const name =
            r.kind === "thread" ? (r.with_id ? r.with_name : `${r.org_label} ${leaders}`) : r.title;
          const preview =
            r.kind === "thread"
              ? `${r.last_direction === "in" ? "You: " : r.with_id ? "" : `${firstName(r.last_author_name ?? leaders)}: `}${r.last_body}`
              : `${r.sender_name && r.sender_name !== r.title ? `${firstName(r.sender_name)}: ` : ""}${r.body}`;
          const href = r.kind === "thread" ? `/messages/thread/${r.with_id ?? "all"}?org=${r.org_id}#end` : `/messages/a/${r.id}`;
          return (
            <li key={r.kind === "thread" ? `t-${r.org_id}-${r.with_id ?? "all"}` : `a-${r.id}`}>
              <OrgLink href={href} className={rowClass(unread)}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${unread ? "bg-accent" : "bg-transparent"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={unread ? "font-bold" : "font-medium"}>{name}</span>
                    {r.kind === "thread" && r.with_id && <Badge tone="warn">Private</Badge>}
                    {r.kind === "announcement" && <Badge tone="info">Announcement</Badge>}
                    {manyOrgs && <span className="text-xs text-muted">{r.org_label}</span>}
                  </div>
                  <div className={`truncate text-sm ${unread ? "text-text" : "text-muted"}`}>{preview}</div>
                </div>
                {r.kind === "announcement" && r.flyer_file && <FlyerThumb file={r.flyer_file} name={r.flyer_name} />}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted">{friendlyTime(r.last_at, tz)}</span>
                  {r.kind === "thread" && unread && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{r.unread}</span>}
                </div>
              </OrgLink>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** What a member has written: to their leaders and to groups, with whether a leader has seen it. */
export function MemberSentList({ memberId, tz }: { memberId: number; tz: string }) {
  const rows = memberSent(memberId);
  const manyOrgs = new Set(rows.map((r) => r.org_id)).size > 1;
  if (rows.length === 0) return <Empty>You haven&apos;t sent anything yet.</Empty>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map((r) => (
        <li key={r.key}>
          <OrgLink href={r.href} className={rowClass(false)}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium">To {r.to}</span>
                {manyOrgs && <span className="text-xs text-muted">{r.org_label}</span>}
              </div>
              <div className="truncate text-sm text-muted">{r.body}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-muted">{friendlyTime(r.created_at, tz)}</span>
              {r.kind === "thread" && <span className="text-[11px] text-muted">{r.read_at ? "Seen" : "Delivered"}</span>}
            </div>
          </OrgLink>
        </li>
      ))}
    </ul>
  );
}
