import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditPlan, currentVersion, getPlan, planHistory } from "@/lib/plans";
import Link from "next/link";
import { formatDateTime } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { PlanForm } from "../../plan-form";
import { deletePlanAction, savePlanVersion } from "../../actions";

export const metadata = { title: "Edit plan" };

export default async function EditPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const plan = getPlan(user.ward_id, Number((await params).id));
  if (!plan) notFound();
  if (!canEditPlan(user, plan)) redirect(`/plans/${plan.id}`);
  const sp = await searchParams;
  const history = planHistory(plan.id);
  return (
    <>
      <PageHeader title={`Edit ${plan.name}`} back={{ href: `/plans/${plan.id}`, label: "Back to plan" }} subtitle="Saving creates a new version. Earlier versions are kept." />
      <Flash msg={sp.msg} tone="danger" />
      <PlanForm user={user} plan={plan} version={currentVersion(plan.id)} action={savePlanVersion} />
      <section id="history" className="card mt-4 scroll-mt-20 text-sm">
        <div className="font-semibold">Update history</div>
        <p className="mt-1 mb-3 text-muted">Every save is kept. Open one to see the plan as it was then.</p>
        {history.length === 0 ? (
          <p className="text-muted">Not posted yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.map((h, i) => (
              <li key={h.id}>
                <Link href={`/plans/${plan.id}?v=${h.id}`} className="flex flex-wrap justify-between gap-x-4 px-3 py-2 hover:bg-surface-2">
                  <span>
                    {formatDateTime(h.created_at, user.ward.timezone, "LLL d, yyyy h:mm a")}
                    {i === 0 && <span className="text-muted"> (current)</span>}
                  </span>
                  <span className="font-medium">{h.author ?? "Someone no longer in the app"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form action={deletePlanAction} className="card mt-4 text-sm">
        <input type="hidden" name="plan_id" value={plan.id} />
        <div className="font-semibold">Delete this plan</div>
        <p className="mt-1 mb-3 text-muted">Removes the plan and all its versions.</p>
        <SubmitButton className="btn-danger btn-sm" confirm={`Delete ${plan.name} and all its versions?`}>
          Delete plan
        </SubmitButton>
      </form>
    </>
  );
}
