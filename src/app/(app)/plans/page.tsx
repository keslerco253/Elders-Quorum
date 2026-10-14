import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { currentPlan, PLAN_INFO, type PlanKind } from "@/lib/plans";
import { formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Ward plans" subtitle="Review our ward plans and look for ways to serve." />
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(PLAN_INFO) as PlanKind[]).map((k) => {
          const p = currentPlan(user.org_id, k);
          return (
            <Link key={k} href={`/plans/${k}`} className="card block hover:bg-surface-2">
              <div className="mb-1 text-2xl" aria-hidden>
                {k === "temple" ? "🌳" : "🤝"}
              </div>
              <h2 className="h2">{PLAN_INFO[k].title}</h2>
              <p className="mt-1 text-sm text-muted">{PLAN_INFO[k].blurb}</p>
              <p className="mt-3 text-xs text-muted">{p ? `Updated ${formatDateTime(p.created_at, user.ward.timezone, "LLL d, yyyy")}` : "Not posted yet"}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
