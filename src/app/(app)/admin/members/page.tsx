import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
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
       AND (? = '' OR name LIKE '%' || ? || '%' OR display_name LIKE '%' || ? || '%' OR email LIKE '%' || ? || '%' OR phone LIKE '%' || ? || '%')
       ORDER BY name COLLATE NOCASE`,
    )
    .all(user.ward_id, show, q, q, q, q, q) as Member[];
  const joined = members.filter((m) => m.last_login_at).length;

  return (
    <>
      <PageHeader
        title="Members"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={show === "active" ? `${members.length} members · ${joined} have signed in` : `${members.length} moved out or removed`}
        actions={
          <>
            <Link href="/admin/members/import" className="btn-secondary">
              Import from LCR
            </Link>
            <Link href="/admin/members/new" className="btn-primary">
              Add member
            </Link>
          </>
        }
      />
      <Flash msg={sp.msg} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, email or phone" className="input max-w-xs flex-1" />
        <select name="show" defaultValue={show} className="input w-auto">
          <option value="active">Current members</option>
          <option value="inactive">Moved out / removed</option>
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      {members.length === 0 ? (
        <Empty>
          No members found.{" "}
          <Link href="/admin/members/import" className="link">
            Import the quorum list from LCR
          </Link>
          .
        </Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/members/${m.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.display_name}</span>
                    {m.role !== "member" && <Badge tone="info">{ROLE_LABELS[m.role]}</Badge>}
                    {!m.last_login_at && <Badge>Not signed in yet</Badge>}
                    {!m.email && <Badge tone="warn">No email</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted">{[m.phone, m.email].filter(Boolean).join(" · ") || "No contact info"}</div>
                  {m.address && <div className="truncate text-xs text-muted">{m.address}</div>}
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
