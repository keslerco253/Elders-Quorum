import Link from "next/link";
import { requireFeature, requirePresidency } from "@/lib/auth";
import { conductingSchedule, presidencyWithCallings, swapsWaitingOn } from "@/lib/conducting";
import { formatDate, todayIn } from "@/lib/time";
import { leadersWord } from "@/lib/types";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { answerConduct, askConduct, cancelConduct } from "./actions";

export const metadata = { title: "Who's conducting" };

export default async function ConductingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  requireFeature(user, "conducting");
  const sp = await searchParams;
  const today = todayIn(user.ward.timezone);
  const schedule = conductingSchedule(user.org_id, today, 13);
  const people = presidencyWithCallings(user.org_id);
  const waiting = swapsWaitingOn(user.id, today).filter((s) => s.org_id === user.org_id);
  const missing = schedule.some((c) => !c.name);
  const word = leadersWord(user.org);

  return (
    <>
      <PageHeader
        title="Who's conducting"
        back={{ href: "/", label: "Home" }}
        subtitle={`By month: ${user.org.kind === "ward" ? "the bishop" : "the president"} January, April, July and October; the first counselor February, May, August and November; the second counselor March, June, September and December.`}
      />
      <Flash msg={sp.msg} />
      {waiting.map((s) => (
        <div key={s.id} id={`ask-${s.id}`} className="card mb-5 scroll-mt-20 space-y-3 border-accent">
          <div>
            <div className="font-semibold">Can you conduct on {formatDate(s.date)}?</div>
            <div className="text-sm text-muted">
              {s.from_name ?? "Someone"} asked{s.note ? `: "${s.note}"` : "."}
            </div>
          </div>
          <form action={answerConduct} className="flex gap-2">
            <input type="hidden" name="swap_id" value={s.id} />
            <SubmitButton name="answer" value="yes" pendingText="…">
              Yes, I&apos;ll conduct
            </SubmitButton>
            <SubmitButton name="answer" value="no" className="btn-secondary" pendingText="…">
              I can&apos;t
            </SubmitButton>
          </form>
        </div>
      ))}
      {missing && (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          Some months have no one: set each {word} member&apos;s calling under{" "}
          <Link href="/admin/members" className="underline">
            Admin → Members
          </Link>
          .
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {schedule.map((c) => {
          const mine = c.memberId === user.id && !c.conference;
          return (
            <li key={c.date} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{formatDate(c.date, "short")}</div>
                  <div className="text-sm text-muted">
                    {c.conference ? (
                      `${c.conference}: no meeting`
                    ) : c.name ? (
                      <>
                        <span className="text-text">{c.memberId === user.id ? "You" : c.name}</span>
                        {c.insteadOf ? ` (instead of ${c.insteadOf})` : ` · ${c.calling}`}
                      </>
                    ) : (
                      `No ${c.calling} set`
                    )}
                  </div>
                </div>
                {c.pending && !c.conference && <Badge tone="info">Asked {c.pending.toId === user.id ? "you" : c.pending.toName}</Badge>}
              </div>
              {mine && c.pending?.fromId === user.id && (
                <form action={cancelConduct} className="mt-2">
                  <input type="hidden" name="swap_id" value={c.pending.id} />
                  <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                    Withdraw the request
                  </SubmitButton>
                </form>
              )}
              {mine && !c.pending && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-accent">Can&apos;t be there? Ask someone to conduct</summary>
                  <form action={askConduct} className="mt-2 space-y-2">
                    <input type="hidden" name="date" value={c.date} />
                    <select name="to_id" required defaultValue="" className="input">
                      <option value="" disabled>
                        Choose someone…
                      </option>
                      {people
                        .filter((p) => p.id !== user.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <input name="note" maxLength={300} className="input" placeholder="Note (optional), e.g. I'll be out of town" />
                    <SubmitButton className="btn-primary btn-sm" pendingText="Sending…">
                      Send request
                    </SubmitButton>
                    <p className="hint">They get a notification to say yes or no. Once they say yes, the whole {word} is told who&apos;s conducting.</p>
                  </form>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
