import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { orgPresidency, orgRoster } from "@/lib/orgs";
import { AssignmentForm } from "@/components/assignment-form";
import { Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "New assignment" };

/** A presidency member gives an assignment from My assignments (not only in a meeting). */
export default async function NewAssignmentPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New assignment" back={{ href: "/assignments", label: "My assignments" }} subtitle={`For anyone in ${user.orgLabel}.`} />
      <Flash msg={sp.msg} tone="warn" />
      <div className="max-w-xl">
        <AssignmentForm people={orgRoster(user.org_id)} presidencyIds={orgPresidency(user.org_id).map((p) => p.id)} back="/assignments" defaultAssignee={user.id} cancelHref="/assignments" />
        <p className="mt-3 text-sm text-muted">
          Everyone&apos;s assignments, with their progress, are under{" "}
          <Link href="/admin/todos" className="link">
            Admin → Assignments
          </Link>
          .
        </p>
      </div>
    </>
  );
}
