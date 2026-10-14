import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { currentPlan, isPlanKind, PLAN_INFO, planHistory, planVersion } from "@/lib/plans";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/time";
import { Empty, Flash, PageHeader } from "@/components/ui";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { kind } = await params;
  const sp = await searchParams;
  if (!isPlanKind(kind)) notFound();
  const latest = currentPlan(user.org_id, kind);
  const shown = sp.v ? planVersion(user.org_id, kind, Number(sp.v)) : latest;
  const old = shown && latest && shown.id !== latest.id;
  const history = sp.history ? planHistory(user.org_id, kind) : [];
  const tz = user.ward.timezone;

  return (
    <>
      <PageHeader
        title={shown?.title || PLAN_INFO[kind].title}
        back={{ href: "/plans", label: "Plans" }}
        subtitle={shown ? `Updated ${formatDateTime(shown.created_at, tz, "LLLL d, yyyy")}${shown.author ? ` by ${shown.author}` : ""}` : undefined}
        actions={
          isAdmin(user) && (
            <Link href={`/plans/${kind}/edit`} className="btn-primary">
              {latest ? "Update plan" : "Post plan"}
            </Link>
          )
        }
      />
      <Flash msg={sp.msg} />
      {old && (
        <div className="mb-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
          You&apos;re viewing an older version.{" "}
          <Link href={`/plans/${kind}`} className="font-semibold underline">
            See the current plan
          </Link>
        </div>
      )}
      {!shown ? (
        <Empty>This plan hasn&apos;t been posted yet.</Empty>
      ) : (
        <article className="card">
          {shown.pdf_file && (
            <a href={`/files/${shown.pdf_file}`} target="_blank" rel="noreferrer" className="btn-secondary mb-4">
              📄 Open PDF: {shown.pdf_name}
            </a>
          )}
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
                    <Link href={`/plans/${kind}?v=${h.id}`} className="flex justify-between px-4 py-2 hover:bg-surface-2">
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
            <Link href={`/plans/${kind}?history=1${sp.v ? `&v=${sp.v}` : ""}`} className="link text-sm">
              See earlier versions
            </Link>
          )}
        </div>
      )}
    </>
  );
}
