import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createGroup } from "../messages/actions";

export const metadata = { title: "Message groups" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const groups = db()
    .prepare("SELECT g.id, g.name, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS n FROM groups g WHERE g.ward_id = ? ORDER BY g.name")
    .all(user.ward_id) as { id: number; name: string; n: number }[];
  return (
    <>
      <PageHeader title="Message groups" back={{ href: "/admin/messages", label: "Send a message" }} subtitle="Custom groups for messages, such as a service committee or the activities team." />
      <Flash msg={sp.msg} />
      <form action={createGroup} className="mb-5 flex gap-2">
        <input name="name" required placeholder="New group name" className="input max-w-xs" />
        <SubmitButton>Create</SubmitButton>
      </form>
      {groups.length === 0 ? (
        <Empty>No custom groups yet.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/admin/groups/${g.id}`} className="flex justify-between px-4 py-3 hover:bg-surface-2">
                <span className="font-medium">{g.name}</span>
                <span className="text-sm text-muted">{g.n} members ›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
