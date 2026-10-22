import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { challengeTeams, listChallenges, memberTeams, scoreboard, statusOf } from "@/lib/challenges";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Challenges" };

/** The ward's friendly challenges between organizations (More → Challenges): on now first, with team totals. */
export default async function ChallengesPage() {
  const user = await requireUser();
  const today = todayIn(user.ward.timezone);
  const challenges = listChallenges(user.ward_id).sort((a, b) => Number(statusOf(a, today) === "finished") - Number(statusOf(b, today) === "finished"));
  const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));
  return (
    <>
      <PageHeader title="Challenges" back={{ href: "/more", label: "More" }} subtitle="Friendly competitions between organizations. Open one to see who's ahead and log what you did." />
      {challenges.length === 0 ? (
        <Empty>No challenges right now.</Empty>
      ) : (
        <ul className="space-y-3">
          {challenges.map((c) => {
            const status = statusOf(c, today);
            const board = scoreboard(c.id);
            const onTeam = memberTeams(c.id, user.id).length > 0;
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
                  {status === "running" && onTeam && <div className="mt-2 text-sm font-semibold text-accent">Log what you did ›</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
