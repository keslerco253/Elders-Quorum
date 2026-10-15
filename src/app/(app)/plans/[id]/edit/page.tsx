import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditPlan, currentVersion, getPlan } from "@/lib/plans";
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
  return (
    <>
      <PageHeader title={`Edit ${plan.name}`} back={{ href: `/plans/${plan.id}`, label: "Back to plan" }} subtitle="Saving creates a new version. Earlier versions are kept." />
      <Flash msg={sp.msg} tone="danger" />
      <PlanForm user={user} plan={plan} version={currentVersion(plan.id)} action={savePlanVersion} />
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
