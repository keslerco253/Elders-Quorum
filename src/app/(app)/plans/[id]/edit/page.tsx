import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditPlan, currentVersion, getPlan, planHistory, planIcon, PLAN_ICON_CHOICES } from "@/lib/plans";
import { PlanIconView } from "@/components/plan-icons";
import Link from "next/link";
import { formatDateTime } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { PlanForm } from "../../plan-form";
import { deletePlanAction, savePlanVersion, setPlanIconAction } from "../../actions";

export const metadata = { title: "Edit plan" };

export default async function EditPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const plan = getPlan(user.ward_id, Number((await params).id));
  if (!plan) notFound();
  if (!canEditPlan(user, plan)) redirect(`/plans/${plan.id}`);
  const sp = await searchParams;
  const history = planHistory(plan.id);
  const current = planIcon(plan);
  return (
    <>
      <PageHeader title={`Edit ${plan.name}`} back={{ href: `/plans/${plan.id}`, label: "Back to plan" }} subtitle="Saving creates a new version. Earlier versions are kept." />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "danger"} />
      <PlanForm user={user} plan={plan} version={currentVersion(plan.id)} action={savePlanVersion} />
      <form id="icon" action={setPlanIconAction} className="card mt-4 scroll-mt-20 space-y-3 text-sm">
        <input type="hidden" name="plan_id" value={plan.id} />
        <div className="flex items-center gap-3">
          <PlanIconView icon={current} />
          <div>
            <div className="font-semibold">Plan icon</div>
            <p className="text-muted">Shown with this plan on the Plans page. Pick one, or use your own picture.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLAN_ICON_CHOICES.map((k) => (
            <label key={k} className="cursor-pointer rounded-xl border border-border p-1 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent">
              <input type="radio" name="icon" value={k} defaultChecked={"key" in current && current.key === k} className="sr-only" />
              <PlanIconView icon={{ key: k }} className="h-11 w-11" />
            </label>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="icon_file">
            Or use your own picture
          </label>
          <input id="icon_file" name="icon_file" type="file" accept="image/*" className="input py-1.5" />
          <p className="hint">A square picture works best (for example a photo of your ward&apos;s temple or a logo).</p>
        </div>
        <SubmitButton pendingText="Saving…">Save icon</SubmitButton>
      </form>
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
