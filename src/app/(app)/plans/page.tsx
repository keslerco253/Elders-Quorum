import Link from "next/link";
import { PlanIconView } from "@/components/plan-icons";
import { requireUser } from "@/lib/auth";
import { audienceText, canCreatePlans, listPlans, PLAN_BLURBS, planIcon } from "@/lib/plans";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const plans = listPlans(user.ward_id, user.org);
  return (
    <>
      <PageHeader
        title="Ward plans"
        subtitle={user.org.kind === "ward" ? "Every plan in the ward." : `Whole-ward plans and ${user.orgLabel}'s own.`}
        actions={
          canCreatePlans(user) && (
            <Link href="/plans/new" className="btn-primary">
              New plan
            </Link>
          )
        }
      />
      <Flash msg={sp.msg} />
      {plans.length === 0 ? (
        <Empty>No plans yet.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <Link key={p.id} href={`/plans/${p.id}`} className="card block hover:bg-surface-2">
              <div className="mb-1" aria-hidden>
                <PlanIconView icon={planIcon(p)} />
              </div>
              <h2 className="h2">{p.name}</h2>
              {p.legacy_kind && PLAN_BLURBS[p.legacy_kind] && <p className="mt-1 text-sm text-muted">{PLAN_BLURBS[p.legacy_kind]}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={p.org_ids.length ? "info" : undefined}>{audienceText(p, user.orgs)}</Badge>
                {p.updated_at ? `Updated ${formatDateTime(p.updated_at, user.ward.timezone, "LLL d, yyyy")}` : "Not posted yet"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
