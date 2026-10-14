import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { wardConversations } from "@/lib/conversations";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, PageHeader, Section } from "@/components/ui";
import { orgRoster } from "@/lib/orgs";

export const metadata = { title: "Replies" };

export default async function RepliesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  if (sp.to) redirect(`/admin/replies/${Number(sp.to)}`);
  const tz = user.ward.timezone;
  const list = wardConversations(user.org_id, user.id);
  const members = orgRoster(user.org_id);

  return (
    <>
      <PageHeader title="Replies" back={{ href: "/admin", label: "Admin" }} subtitle="What members send the leaders, in the app or by text. Messages a member sent privately to one of you show only to that person." />
      {list.length === 0 ? (
        <Empty>No replies yet.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {list.map((c) => (
            <li key={`${c.member_id}-${c.recipient_id ?? "all"}`}>
              <Link href={`/admin/replies/${c.member_id}${c.recipient_id ? "?private=1" : ""}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={c.unread ? "font-bold" : "font-medium"}>{c.member_name}</span>
                    {c.recipient_id && <Badge tone="warn">Private to you</Badge>}
                    {c.unread > 0 && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unread}</span>}
                  </div>
                  <div className="truncate text-sm text-muted">
                    {c.last_direction === "out" ? "You: " : ""}
                    {c.last_body}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(c.last_at, tz, "LLL d")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Section title="Message one person">
        <form className="card flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="to">
              Member
            </label>
            <select id="to" name="to" required className="input" defaultValue="">
              <option value="">Choose a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-secondary">Open conversation</button>
        </form>
      </Section>
    </>
  );
}
