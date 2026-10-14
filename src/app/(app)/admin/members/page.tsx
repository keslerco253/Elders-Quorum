import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { isPresidency } from "@/lib/permissions";
import { addMember } from "./actions";
import { callingLabel, isCalling, roleLabel, type Member, type Role } from "@/lib/types";

export const metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const show = sp.show === "inactive" ? "inactive" : "active";
  const q = (sp.q ?? "").trim();
  // Everyone who officially belongs to (or leads) this organization.
  const members = db()
    .prepare(
      `SELECT m.*, om.role, om.calling FROM members m JOIN org_members om ON om.member_id = m.id AND om.org_id = ?
       WHERE m.status = ? AND (om.official = 1 OR om.role <> 'member')
       AND (? = '' OR m.display_name LIKE '%' || ? || '%')
       ORDER BY om.role = 'member', m.display_name COLLATE NOCASE`,
    )
    .all(user.org_id, show, q, q) as (Member & { role: Role; calling: string | null })[];

  return (
    <>
      <PageHeader
        title="Members"
        back={{ href: "/admin", label: "Admin" }}
        subtitle={show === "active" ? `${members.length} ${members.length === 1 ? "person belongs" : "people belong"} to ${user.orgLabel}.` : `${members.length} accounts turned off`}
      />
      <Flash msg={sp.msg} />
      <p className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent">
        {user.org.kind === "ward"
          ? "Everyone who joined the ward with its join code"
          : `Members who chose ${user.orgLabel} as one of their organizations`}
        {isPresidency(user) ? ", plus anyone you add below" : ""}. Open a member to see or fix their contact info. For addresses, use Member Tools.
      </p>
      {isPresidency(user) && show === "active" && (
        <details id="add" className="card mb-4" open={!!sp.add}>
          <summary className="cursor-pointer font-semibold">Add a member</summary>
          <form action={addMember} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="add-name">
                  Name
                </label>
                <input id="add-name" name="name" required maxLength={100} className="input" defaultValue={sp.name} placeholder="e.g. Brother John Smith" />
              </div>
              <div>
                <label className="label" htmlFor="add-contact">
                  Mobile number or email
                </label>
                <input id="add-contact" name="contact" required className="input" defaultValue={sp.contact} autoCapitalize="off" placeholder="(208) 555-0142 or name@example.com" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="add-role">
                  Access level
                </label>
                <select id="add-role" name="role" className="input" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin (can post, schedule and send messages)</option>
                  <option value="presidency">{roleLabel("presidency", user.org)}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="send_invite" defaultChecked /> Email them an invite (email addresses only)
              </label>
            </div>
            <p className="hint">
              They agree to what the app keeps, and choose whether to get texts, the first time they sign in. The app never texts a number you enter until that person agrees, so for a phone number you&apos;ll text them an invite from your own phone on the next screen.
            </p>
            <SubmitButton pendingText="Adding…">Add member</SubmitButton>
          </form>
        </details>
      )}
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name" className="input max-w-xs flex-1" />
        <select name="show" defaultValue={show} className="input w-auto">
          <option value="active">Active</option>
          <option value="inactive">Turned off</option>
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      {members.length === 0 ? (
        <Empty>No one yet. Share the ward&apos;s join code from Admin → Settings so members can join.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/members/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.display_name}</span>
                    {m.role !== "member" && <Badge tone="info">{isCalling(m.calling) ? callingLabel(m.calling, user.org) : roleLabel(m.role, user.org)}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    {m.phone && <Badge>Phone</Badge>}
                    {m.email && <Badge>Email</Badge>}
                    {m.phone && !m.sms_consent_at && <Badge tone="warn">No texts</Badge>}
                    <span>{m.last_login_at ? `last signed in ${formatDateTime(m.last_login_at, user.ward.timezone, "LLL d")}` : "hasn't signed in yet"}</span>
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
