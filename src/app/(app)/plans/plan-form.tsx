import { SubmitButton } from "@/components/client";
import { versionBlocks } from "@/lib/plan-blocks";
import { PlanEditor } from "./plan-editor";
import { ledOrgIds, managesWardPlans, type PlanVersion, type WardPlan } from "@/lib/plans";
import type { CurrentUser } from "@/lib/types";

/** Title, who it's for, and the page itself. Used to post and to update a plan. */
export function PlanForm({ user, plan, version, action }: { user: CurrentUser; plan?: WardPlan; version?: PlanVersion; action: (fd: FormData) => Promise<void> }) {
  const ward = managesWardPlans(user);
  const mine = ledOrgIds(user);
  // Ward leaders choose any organizations (or the whole ward); others, the ones they lead.
  const choices = user.orgs.filter((o) => o.kind === "group" && (ward || mine.includes(o.id)));
  const forOrgs = plan?.org_ids ?? (user.org.kind === "group" ? [user.org_id] : []);
  const wholeWard = !!plan ? plan.org_ids.length === 0 : user.org.kind === "ward";
  // Organization leaders can't change a whole-ward plan's audience (only the bishopric can).
  const showAudience = ward || !wholeWard;
  return (
    <form action={action} className="card space-y-4">
      {plan && <input type="hidden" name="plan_id" value={plan.id} />}
      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" required maxLength={120} className="input" defaultValue={version?.title ?? plan?.name ?? ""} placeholder="e.g. Youth Temple Plan" />
      </div>
      {showAudience && (
        <fieldset>
          <legend className="label">Who it&apos;s for</legend>
          {ward && (
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="audience" value="ward" defaultChecked={wholeWard} /> The whole ward
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="audience" value="orgs" defaultChecked={!wholeWard} /> Only these organizations:
          </label>
          <div className="mt-1 ml-6 flex flex-wrap gap-x-5 gap-y-1">
            {choices.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="org_id" value={o.id} defaultChecked={forOrgs.includes(o.id)} /> {o.label}
              </label>
            ))}
          </div>
          <p className="hint">Everyone can open any plan; it shows on the Plans tab of the organizations it&apos;s for (a whole-ward plan shows everywhere).</p>
        </fieldset>
      )}
      <div>
        <div className="label">Page</div>
        <PlanEditor initial={version ? versionBlocks(version) : []} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="announce" /> Send a notification that this plan was {plan ? "updated" : "posted"}
      </label>
      <SubmitButton>{plan ? "Save plan" : "Post plan"}</SubmitButton>
    </form>
  );
}
