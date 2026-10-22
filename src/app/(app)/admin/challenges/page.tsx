import Link from "next/link";
import { requireFeature, requirePresidency } from "@/lib/auth";
import { challengeTeams, listChallenges, scoreboard, statusOf } from "@/lib/challenges";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Challenges" };

/** Friendly challenges between organizations: start one, and see every one in the ward. */
export default async function AdminChallengesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  requireFeature(user, "challenges");
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const challenges = listChallenges(user.ward_id).sort((a, b) => Number(statusOf(a, today) === "finished") - Number(statusOf(b, today) === "finished"));
  const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));
  return (
    <>
      <PageHeader
        title="Challenges"
        back={{ href: "/admin", label: "Admin" }}
        subtitle="Friendly competitions between organizations, like temple and family history work. Members see them under More → Challenges and on Home, and log what they do there."
        actions={
          <Link href="/admin/challenges/new" className="btn-primary">
            + New challenge
          </Link>
        }
      />
      <Flash msg={sp.msg} />
      {challenges.length === 0 ? (
        <Empty>No challenges yet. Start one with + New challenge.</Empty>
      ) : (
        <ul className="space-y-2">
          {challenges.map((c) => {
            const status = statusOf(c, today);
            const board = scoreboard(c.id);
            return (
              <li key={c.id}>
                <Link href={`/challenges/${c.id}`} className="card block hover:bg-surface-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">🏆 {c.title}</span>
                    {status === "running" ? <Badge tone="success">On now</Badge> : status === "upcoming" ? <Badge tone="info">Starts {formatDate(c.starts_on, "short")}</Badge> : <Badge>Finished</Badge>}
                  </div>
                  <div className="text-sm text-muted">
                    {formatDate(c.starts_on, "short")} to {formatDate(c.ends_on, "short")} · {challengeTeams(c.id).map((t) => t.name).join(" vs. ")}
                  </div>
                  <div className="mt-1 text-sm">
                    {board.map((b, i) => (
                      <span key={b.team.id}>
                        {i > 0 && " · "}
                        <strong>{b.team.name}</strong> {fmt(b.points)}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
