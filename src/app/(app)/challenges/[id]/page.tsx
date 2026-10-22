import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { challengeItems, getChallenge, memberTeams, myEntries, scoreboard, statusOf } from "@/lib/challenges";
import { isPresidencyOf } from "@/lib/assignments";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { deleteChallenge, deleteEntry, logChallenge } from "../actions";

export const metadata = { title: "Challenge" };

const pts = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} ${n === 1 ? "point" : "points"}`;

/** The scoreboard (team totals only, never names), logging, and your own entries. */
export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const c = getChallenge(user.ward_id, Number((await params).id));
  if (!c) notFound();
  const today = todayIn(user.ward.timezone);
  const status = statusOf(c, today);
  const board = scoreboard(c.id);
  const items = challengeItems(c.id);
  const teams = memberTeams(c.id, user.id);
  const mine = myEntries(c.id, user.id);
  const top = Math.max(1, ...board.map((b) => b.points));
  const [first, second] = board;
  const lead = first && second ? Math.round((first.points - second.points) * 10) / 10 : 0;
  const manager = !!c.org_id && isPresidencyOf(user.id, c.org_id);

  return (
    <>
      <PageHeader title={c.title} back={{ href: "/challenges", label: "Challenges" }} subtitle={`${formatDate(c.starts_on, "short")} to ${formatDate(c.ends_on, "short")}`} />
      <Flash msg={sp.msg} />
      <div className="mb-4">
        {status === "running" ? <Badge tone="success">On now</Badge> : status === "upcoming" ? <Badge tone="info">Starts {formatDate(c.starts_on, "short")}</Badge> : <Badge>Finished</Badge>}
      </div>

      <Section title={status === "finished" ? "Final scores" : "Who's ahead"}>
        <div className="card space-y-4">
          {first && first.points > 0 ? (
            <p className="text-lg font-semibold">
              {status === "finished" ? "🏆" : "🥇"} {first.team.name}
              {status === "finished" ? " wins" : " leads"}
              {lead > 0 ? ` by ${pts(lead)}` : second && lead === 0 ? " (tied)" : ""}
            </p>
          ) : (
            <p className="text-muted">No points yet. Be the first to log something!</p>
          )}
          <ul className="space-y-3">
            {board.map((b) => (
              <li key={b.team.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{b.team.name}</span>
                  <strong>{pts(b.points)}</strong>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(b.points / top) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="hint">Team totals only: no one can see what anyone else logged.</p>
        </div>
      </Section>

      {status === "running" && teams.length > 0 && (
        <div className="mt-6">
          <Section title="Log what you did">
            <form action={logChallenge} className="card max-w-xl space-y-3">
              <input type="hidden" name="challenge_id" value={c.id} />
              {teams.length > 1 ? (
                <select name="team_id" required className="input" defaultValue="" aria-label="Your team">
                  <option value="" disabled>
                    Which team?
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="hidden" name="team_id" value={teams[0].id} />
              )}
              <select name="item_id" required className="input" defaultValue="" aria-label="What you did">
                <option value="" disabled>
                  What did you do?
                </option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label} ({i.points} {i.points === 1 ? "pt" : "pts"} each)
                  </option>
                ))}
              </select>
              <input name="amount" type="number" min={0.5} step={0.5} max={1000} required defaultValue={1} className="input w-32" aria-label="How many" />
              <SubmitButton pendingText="Logging…">+ Log it</SubmitButton>
              <p className="hint">For {teams.length > 1 ? "the team you choose" : teams[0].name}. Only your team&apos;s total changes; no one sees your entries.</p>
            </form>
          </Section>
        </div>
      )}

      {mine.length > 0 && (
        <div className="mt-6">
          <Section title="What you logged (only you see this)">
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {mine.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    {e.amount} × {e.label} <span className="text-muted">· {pts(e.points)}</span>
                  </span>
                  {status === "running" && (
                    <form action={deleteEntry}>
                      <input type="hidden" name="challenge_id" value={c.id} />
                      <input type="hidden" name="entry_id" value={e.id} />
                      <SubmitButton className="btn-secondary btn-sm" confirm="Remove this entry?" pendingText="…">
                        ✕
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <div className="mt-6">
        <Section title="What counts">
          <ul className="card space-y-1 text-sm">
            {items.map((i) => (
              <li key={i.id}>
                {i.label}: <strong>{i.points}</strong> {i.points === 1 ? "point" : "points"} each
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {manager && (
        <Link href={`/admin/challenges/${c.id}/edit`} className="btn-secondary btn-sm mt-6 mr-2 inline-block">
          Edit challenge
        </Link>
      )}
      {manager && (
        <form action={deleteChallenge} className="mt-6 inline-block">
          <input type="hidden" name="challenge_id" value={c.id} />
          <SubmitButton className="btn-secondary btn-sm" confirm="Delete this challenge and everything logged for it?" pendingText="Deleting…">
            Delete challenge
          </SubmitButton>
        </form>
      )}
    </>
  );
}
