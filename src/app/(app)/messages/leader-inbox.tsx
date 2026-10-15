import Link from "next/link";
import { OrgLink } from "@/components/org-link";
import { leaderInbox } from "@/lib/conversations";
import { friendlyTime } from "@/lib/time";
import { firstName } from "@/lib/names";
import { Badge, Empty } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";

/** A leader's inbox: one row per person (and per private conversation), across every organization they lead. */
export function LeaderInbox({ viewerId, tz, unreadOnly, q }: { viewerId: number; tz: string; unreadOnly: boolean; q: string }) {
  const rows = leaderInbox(viewerId, { unreadOnly, q });
  const all = unreadOnly || q ? leaderInbox(viewerId) : rows;
  const unread = all.reduce((n, r) => n + (r.unread > 0 ? 1 : 0), 0);
  const manyOrgs = new Set(all.map((r) => r.org_id)).size > 1;
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm font-medium ${on ? "bg-primary text-primary-text" : "bg-surface-2 text-muted hover:text-text"}`;
  const href = (o: { unread?: boolean; q?: string }) => {
    const p = new URLSearchParams();
    if (o.unread) p.set("show", "unread");
    if (o.q) p.set("q", o.q);
    const s = p.toString();
    return `/messages${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <LiveRefresh seconds={20} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={href({ q })} className={chip(!unreadOnly)}>
          All
        </Link>
        <Link href={href({ unread: true, q })} className={chip(unreadOnly)}>
          Unread{unread ? ` (${unread})` : ""}
        </Link>
        <form action="/messages" className="ml-auto flex min-w-48 flex-1 justify-end sm:flex-none">
          {unreadOnly && <input type="hidden" name="show" value="unread" />}
          <input name="q" defaultValue={q} placeholder="Search by name" className="input py-1.5 text-sm" type="search" aria-label="Search conversations by name" />
        </form>
      </div>
      {rows.length === 0 ? (
        <Empty>{q ? `No conversations with "${q}".` : unreadOnly ? "You're all caught up." : "No messages from members yet."}</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {rows.map((c) => (
            <li key={`${c.org_id}-${c.member_id}-${c.recipient_id ?? "all"}`}>
              <OrgLink
                href={`/admin/replies/${c.member_id}?org=${c.org_id}${c.recipient_id ? "&private=1" : ""}#end`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 ${c.unread ? "bg-accent-soft/40" : ""}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.unread ? "bg-accent" : "bg-transparent"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={c.unread ? "font-bold" : "font-medium"}>{c.member_name}</span>
                    {c.recipient_id && <Badge tone="warn">Private</Badge>}
                    {c.last_direction === "in" && <Badge tone="info">Needs reply</Badge>}
                    {manyOrgs && <span className="text-xs text-muted">{c.org_label}</span>}
                  </div>
                  <div className={`truncate text-sm ${c.unread ? "text-text" : "text-muted"}`}>
                    {c.last_direction === "out" ? (c.last_author_id === viewerId ? "You: " : `${firstName(c.last_author_name ?? "Presidency")}: `) : ""}
                    {c.last_body}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted">{friendlyTime(c.last_at, tz)}</span>
                  {c.unread > 0 && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unread}</span>}
                </div>
              </OrgLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
