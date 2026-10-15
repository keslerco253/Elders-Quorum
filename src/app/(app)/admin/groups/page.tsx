import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createGroup } from "../messages/actions";
import { canManage, orgGroups, sendersText } from "@/lib/groups";
import { SenderChoices } from "./sender-choices";

export const metadata = { title: "Message groups" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const groups = orgGroups(user.org_id).filter((g) => canManage(g, user.role));
  // Organizations this person leads, where they can put a new group.
  const orgChoices = user.orgs.filter((o) => o.role === "presidency");
  return (
    <>
      <PageHeader title="Message groups" back={{ href: "/admin", label: "Admin" }} subtitle="Custom groups for messages, such as a service committee or the activities team." />
      <Flash msg={sp.msg} />
      {groups.length === 0 ? (
        <Empty>No custom groups in {user.orgLabel} yet.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/admin/groups/${g.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                <span>
                  <span className="font-medium">{g.name}</span>
                  <span className="block text-xs text-muted">Sent by: {sendersText(g, user.org)}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">{g.n} {g.n === 1 ? "member" : "members"} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <details className="card mt-5 max-w-xl" open={groups.length === 0}>
        <summary className="cursor-pointer font-semibold">Create a group</summary>
        <form action={createGroup} className="mt-3 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Group name
            </label>
            <input id="name" name="name" required maxLength={80} placeholder="e.g. Activities committee" className="input" />
          </div>
          {orgChoices.length > 1 && (
            <div>
              <label className="label" htmlFor="org_id">
                Organization
              </label>
              <select id="org_id" name="org_id" className="input" defaultValue={user.org_id}>
                {orgChoices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="hint">Its members are chosen from this organization.</p>
            </div>
          )}
          <SenderChoices org={user.org} />
          <SubmitButton>Create group</SubmitButton>
        </form>
      </details>
    </>
  );
}
