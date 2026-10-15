import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audienceText, canEditPlan, currentVersion, getPlan, planByLegacyKind, planHistory, planVersion } from "@/lib/plans";
import { renderMarkdown } from "@/lib/markdown";
import { isPicture } from "@/lib/upload-names";
import { formatDateTime } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

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
  const shown = sp.v ? planVersion(plan.id, Number(sp.v)) : latest;
  const old = shown && latest && shown.id !== latest.id;
  const history = sp.history ? planHistory(plan.id) : [];
  const tz = user.ward.timezone;

  return (
    <>
      <PageHeader
        title={shown?.title || plan.name}
        back={{ href: "/plans", label: "Plans" }}
        subtitle={shown ? `Updated ${formatDateTime(shown.created_at, tz, "LLLL d, yyyy")}${shown.author ? ` by ${shown.author}` : ""}` : undefined}
        actions={
          canEditPlan(user, plan) && (
            <Link href={`/plans/${plan.id}/edit`} className="btn-primary">
              {latest ? "Update plan" : "Post plan"}
            </Link>
          )
        }
      />
      <Flash msg={sp.msg} />
      <div className="mb-4">
        <Badge tone={plan.org_ids.length ? "info" : undefined}>For: {audienceText(plan, user.orgs)}</Badge>
      </div>
      {old && (
        <div className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
          You&apos;re viewing an older version.{" "}
          <Link href={`/plans/${plan.id}`} className="font-semibold underline">
            See the current plan
          </Link>
        </div>
      )}
      {!shown ? (
        <Empty>This plan hasn&apos;t been posted yet.</Empty>
      ) : (
        <article className="card">
          {shown.pdf_file &&
            (isPicture(shown.pdf_file) ? (
              <a href={`/files/${shown.pdf_file}`} target="_blank" rel="noreferrer" className="mb-4 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/${shown.pdf_file}`} alt={shown.pdf_name ?? "Plan picture"} className="w-full rounded-lg border border-border" />
              </a>
            ) : (
              <a href={`/files/${shown.pdf_file}`} target="_blank" rel="noreferrer" className="btn-secondary mb-4">
                📄 Open {shown.pdf_file.endsWith(".pdf") ? "PDF" : "file"}: {shown.pdf_name}
              </a>
            ))}
          {shown.body ? <div className="prose-eq" dangerouslySetInnerHTML={{ __html: renderMarkdown(shown.body) }} /> : !shown.pdf_file && <p className="text-muted">No details yet.</p>}
        </article>
      )}
      {latest && (
        <div className="mt-6">
          {sp.history ? (
            <>
              <h2 className="h2 mb-2">Earlier versions</h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
                {history.map((h, i) => (
                  <li key={h.id}>
                    <Link href={`/plans/${plan.id}?v=${h.id}`} className="flex justify-between px-4 py-2 hover:bg-surface-2">
                      <span>
                        {formatDateTime(h.created_at, tz, "LLL d, yyyy h:mm a")}
                        {i === 0 && " (current)"}
                      </span>
                      <span className="text-muted">{h.author}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Link href={`/plans/${plan.id}?history=1${sp.v ? `&v=${sp.v}` : ""}`} className="link text-sm">
              See earlier versions
            </Link>
          )}
        </div>
      )}
    </>
  );
}
