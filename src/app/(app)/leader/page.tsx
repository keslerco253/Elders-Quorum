import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { ledOrgsAnywhere } from "@/lib/orgs";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Admin" };

/** Admin is per organization: someone looking at one they don't lead picks one they do. */
export default async function LeaderPage() {
  const user = await requireUser();
  if (isAdmin(user)) redirect("/admin");
  const led = ledOrgsAnywhere(user.id);
  if (!led.length) redirect("/");
  const manyWards = new Set(led.map((o) => o.ward)).size > 1;
  return (
    <>
      <PageHeader title="Admin" subtitle={`You're looking at ${user.orgLabel}, where you aren't a leader. Admin tools are for the organization you lead.`} />
      <ul className="max-w-md divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {led.map((o) => (
          <li key={o.id}>
            <a href={`/admin?org=${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
              <span className="font-medium">
                Go to {o.label} admin
                {manyWards && o.label !== o.ward && <span className="block text-sm font-normal text-muted">{o.ward}</span>}
              </span>
              <span className="text-muted">›</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
