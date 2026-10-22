import { hasFeature } from "@/lib/orgs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditPlan, currentVersion, getPlan, planByLegacyKind, planVersion } from "@/lib/plans";
import { versionBlocks } from "@/lib/plan-blocks";
import { FlyerThumb } from "@/components/flyer-thumb";
import { isPresidency } from "@/lib/permissions";
import { PlanPage as PlanContent } from "@/components/plan-page";
import { formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader } from "@/components/ui";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  // Old links: /plans/temple, /plans/mission.
  if (!/^\d+$/.test(id)) {
    const legacy = planByLegacyKind(user.ward_id, id);
    if (!legacy) notFound();
    redirect(`/plans/${legacy.id}`);
  }
  const plan = getPlan(user.ward_id, Number(id));
  if (!plan) notFound();
  const latest = currentVersion(plan.id);
  const shown = sp.v && canEditPlan(user, plan) ? (planVersion(plan.id, Number(sp.v)) ?? latest) : latest;
  const editor = canEditPlan(user, plan);
  // Older versions are for the people who can edit the plan (see the edit page's update history).
  const old = editor && shown && latest && shown.id !== latest.id;
  const tz = user.ward.timezone;

  return (
    <>
      <PageHeader
        title={shown?.title || plan.name}
        back={{ href: "/plans", label: "Plans" }}
        actions={
          editor && (
            <>
              {latest && (
                <Link href={`/plans/${plan.id}/edit#add`} className="btn-secondary">
                  Add pictures or PDFs
                </Link>
              )}
              <Link href={`/plans/${plan.id}/edit`} className="btn-primary">
                {latest ? "Update plan" : "Post plan"}
              </Link>
            </>
          )
        }
      />
      <Flash msg={sp.msg} />
      {old && (
        <div className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
          You&apos;re viewing the version saved {formatDateTime(shown.created_at, tz, "LLL d, yyyy h:mm a")}
          {shown.author ? ` by ${shown.author}` : ""}.{" "}
          <Link href={`/plans/${plan.id}`} className="font-semibold underline">
            See the current plan
          </Link>{" "}
          ·{" "}
          <Link href={`/plans/${plan.id}/edit#history`} className="font-semibold underline">
            Update history
          </Link>
        </div>
      )}
      {!shown ? (
        <Empty>This plan hasn&apos;t been posted yet.</Empty>
      ) : (
        <article className="card p-5 sm:p-8">
          {(() => {
            const blocks = versionBlocks(shown);
            return blocks.length ? <PlanContent blocks={blocks} /> : <p className="text-muted">No details yet.</p>;
          })()}
        </article>
      )}
      {editor && isPresidency(user) && latest && hasFeature(user.org, "shared") && (() => {
        const media = versionBlocks(latest).filter((b) => b.type === "image" || b.type === "pdf") as { file: string; name: string; caption: string }[];
        return (
            <details className="card mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Share publicly (link and QR code)</summary>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-border pb-3">
                <span className="min-w-0 flex-1">
                  <strong>The whole page</strong>
                  <span className="block text-muted">Every picture and PDF on it, and any updates you post later.</span>
                </span>
                <a href={`/admin/shared/new?plan=${plan.id}`} className="btn-primary btn-sm">
                  Share this whole page
                </a>
              </div>
              {media.length > 0 && <div className="mt-3 font-semibold">Or just one picture or PDF:</div>}
              <ul className="mt-1 divide-y divide-border">
                {media.map((m) => (
                  <li key={m.file} className="flex items-center gap-3 py-2">
                    <FlyerThumb file={m.file} name={m.name} />
                    <span className="min-w-0 flex-1 truncate">{m.caption || m.name}</span>
                    <a href={`/admin/shared/new?${new URLSearchParams({ file: m.file, title: m.caption || plan.name })}`} className="btn-secondary btn-sm">
                      Share publicly
                    </a>
                  </li>
                ))}
              </ul>
            </details>
        );
      })()}
    </>
  );
}
