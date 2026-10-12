import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { deleteGroup, saveGroup } from "../../messages/actions";

export const metadata = { title: "Edit group" };

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const id = Number((await params).id);
  const sp = await searchParams;
  const g = db().prepare("SELECT id, name FROM groups WHERE id = ? AND ward_id = ?").get(id, user.ward_id) as { id: number; name: string } | undefined;
  if (!g) notFound();
  const inGroup = new Set((db().prepare("SELECT member_id FROM group_members WHERE group_id = ?").all(id) as { member_id: number }[]).map((r) => r.member_id));
  const members = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  return (
    <>
      <PageHeader title={g.name} back={{ href: "/admin/groups", label: "Groups" }} />
      <Flash msg={sp.msg} />
      <form action={saveGroup} className="card space-y-4">
        <input type="hidden" name="item_id" value={g.id} />
        <div>
          <label className="label" htmlFor="name">
            Group name
          </label>
          <input id="name" name="name" defaultValue={g.name} className="input max-w-sm" />
        </div>
        <fieldset>
          <legend className="label">Members</legend>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" name="member_id" value={m.id} defaultChecked={inGroup.has(m.id)} />
                {m.display_name}
              </label>
            ))}
          </div>
        </fieldset>
        <SubmitButton>Save group</SubmitButton>
      </form>
      <form action={deleteGroup} className="mt-4">
        <input type="hidden" name="item_id" value={g.id} />
        <SubmitButton className="btn-danger btn-sm" confirm="Delete this group?">
          Delete group
        </SubmitButton>
      </form>
    </>
  );
}
