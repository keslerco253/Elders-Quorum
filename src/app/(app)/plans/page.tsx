import Link from "next/link";
import { PlanIconView } from "@/components/plan-icons";
import { requireUser } from "@/lib/auth";
import { audienceText, canCreatePlans, listPlans, PLAN_BLURBS, planIcon } from "@/lib/plans";
import { formatDate, formatDateTime, todayIn } from "@/lib/time";
import { listChallenges, scoreboard, statusOf } from "@/lib/challenges";
import { isPresidency } from "@/lib/permissions";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const plans = listPlans(user.ward_id, user.org);
  // Friendly challenges between organizations: running and upcoming first.
  const today = todayIn(user.ward.timezone);
  const challenges = listChallenges(user.ward_id).sort((a, b) => Number(statusOf(a, today) === "finished") - Number(statusOf(b, today) === "finished"));
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
      {(challenges.length > 0 || isPresidency(user)) && (
        <div className="mb-6">
          <Section
            title="Challenges"
            actions={
              isPresidency(user) && (
                <Link href="/plans/challenges/new" className="link text-sm">
                  + New challenge
                </Link>
              )
            }
          >
            {challenges.length === 0 ? (
              <p className="text-sm text-muted">A friendly competition between organizations, like temple and family history work. Start one with + New challenge.</p>
            ) : (
              <ul className="space-y-2">
                {challenges.slice(0, 6).map((c) => {
                  const status = statusOf(c, today);
                  const [first] = scoreboard(c.id);
                  return (
                    <li key={c.id}>
                      <Link href={`/plans/challenges/${c.id}`} className="card flex items-center justify-between gap-3 hover:bg-surface-2">
                        <span className="min-w-0">
                          <span className="block font-semibold">🏆 {c.title}</span>
                          <span className="text-sm text-muted">
                            {status === "finished" ? `Ended ${formatDate(c.ends_on, "short")}` : status === "upcoming" ? `Starts ${formatDate(c.starts_on, "short")}` : `Until ${formatDate(c.ends_on, "short")}`}
                            {first && first.points > 0 && ` · ${first.team.name} ${status === "finished" ? "won" : "leads"}`}
                          </span>
                        </span>
                        {status === "running" ? <Badge tone="success">On now</Badge> : status === "upcoming" ? <Badge tone="info">Soon</Badge> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      )}
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
