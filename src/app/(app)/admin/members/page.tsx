import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { ROLE_LABELS, type Member } from "@/lib/types";

export const metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const show = sp.show === "inactive" ? "inactive" : "active";
  const q = (sp.q ?? "").trim();
  const members = db()
    .prepare(
      `SELECT * FROM members WHERE ward_id = ? AND status = ?
       AND (? = '' OR display_name LIKE '%' || ? || '%' OR email LIKE '%' || ? || '%')
       ORDER BY role = 'member', display_name COLLATE NOCASE`,
    )
    .all(user.ward_id, show, q, q, q) as Member[];

  return (
    <>
      <PageHeader
        title="Members"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={show === "active" ? `${members.length} people have joined the app.` : `${members.length} accounts turned off`}
      />
      <Flash msg={sp.msg} />
      <p className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
        Members join the app themselves. Only their name and email are stored. For addresses and phone numbers, use Member Tools.
      </p>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input max-w-xs flex-1" />
        <select name="show" defaultValue={show} className="input w-auto">
          <option value="active">Active</option>
          <option value="inactive">Turned off</option>
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      {members.length === 0 ? (
        <Empty>No one yet. Share the join code from Admin → Settings so members can join.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.display_name}</span>
                    {m.role !== "member" && <Badge tone="info">{ROLE_LABELS[m.role]}</Badge>}
                  </div>
                  <div className="truncate text-sm text-muted">
                    {m.email} · {m.last_login_at ? `last signed in ${formatDateTime(m.last_login_at, user.ward.timezone, "LLL d")}` : "hasn't signed in yet"}
                  </div>
                </div>
                <span className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
