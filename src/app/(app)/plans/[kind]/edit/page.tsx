import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { currentPlan, isPlanKind, PLAN_INFO } from "@/lib/plans";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { savePlan } from "../../actions";

export const metadata = { title: "Edit plan" };

export default async function EditPlanPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const { kind } = await params;
  const sp = await searchParams;
  if (!isPlanKind(kind)) notFound();
  const p = currentPlan(user.ward_id, kind);
  return (
    <>
      <PageHeader title={`Edit ${PLAN_INFO[kind].title}`} back={{ href: `/plans/${kind}`, label: "Back to plan" }} subtitle="Saving creates a new version. Earlier versions are kept." />
      <Flash msg={sp.msg} tone="danger" />
      <form action={savePlan} className="card space-y-4">
        <input type="hidden" name="kind" value={kind} />
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input id="title" name="title" className="input" defaultValue={p?.title ?? PLAN_INFO[kind].title} />
        </div>
        <div>
          <label className="label" htmlFor="body">
            Plan
          </label>
          <textarea id="body" name="body" rows={18} className="input font-mono text-sm" defaultValue={p?.body ?? ""} placeholder={"## Goals\n- Every family submits one name to the temple\n\n## Upcoming\n- Temple night: third Thursday"} />
          <p className="hint">
            Formatting: <code>## Heading</code>, <code>- bullet</code>, <code>**bold**</code>, <code>[link text](https://…)</code>
          </p>
        </div>
        <div>
          <label className="label" htmlFor="pdf">
            PDF (optional)
          </label>
          {p?.pdf_file && (
            <p className="mb-2 text-sm">
              Current: {p.pdf_name}{" "}
              <label className="ml-2 text-muted">
                <input type="checkbox" name="remove_pdf" /> remove
              </label>
            </p>
          )}
          <input id="pdf" name="pdf" type="file" accept="application/pdf" className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="announce" /> Notify the quorum that this plan was updated
        </label>
        <SubmitButton>Save plan</SubmitButton>
      </form>
    </>
  );
}
