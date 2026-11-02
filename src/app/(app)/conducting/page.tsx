import Link from "next/link";
import { HandbookLinks } from "@/components/handbook-link";
import { MEETINGS } from "@/lib/handbook";
import { requireFeature, requirePresidency } from "@/lib/auth";
import { CONDUCT_MODES, conductingSchedule, conductSettings, presidencyWithCallings, swapsWaitingOn } from "@/lib/conducting";
import { DateTime } from "luxon";
import { formatDate, todayIn } from "@/lib/time";
import { leadersWord } from "@/lib/types";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { answerConduct, askConduct, cancelConduct, changeConductor, saveConductingSetup } from "./actions";

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
  const how = conductSettings(user.org_id);
  const ordinal = ["1st", "2nd", "3rd", "4th", "5th"];
  // The next 12 months, to pick who conducts each.
  const months = Array.from({ length: 12 }, (_, i) => DateTime.fromISO(today).startOf("month").plus({ months: i }));
  const personSelect = (name: string, value: number | undefined, label: string) => (
    <select name={name} defaultValue={value ? String(value) : ""} className="input" aria-label={label}>
      <option value="">Not chosen</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
  const subtitle =
    how.mode === "months"
      ? "Who conducts each month is chosen below."
      : how.mode === "sundays"
        ? `Each Sunday of the month has its own person (${ordinal.slice(0, 4).join(", ")} and 5th Sundays).`
        : `By month: ${user.org.kind === "ward" ? "the bishop" : "the president"} January, April, July and October; the first counselor February, May, August and November; the second counselor March, June, September and December.`;

  return (
    <>
      <PageHeader
        title="Who's conducting"
        back={{ href: "/", label: "Home" }}
        subtitle={`${subtitle} ${how.flexible ? `Anyone in the ${word} can change a Sunday.` : "Whoever is scheduled can ask someone else to take a Sunday."}`}
      />
      <Flash msg={sp.msg} />
      <HandbookLinks chapters={[MEETINGS]} />
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
      <details className="card conduct-setup mb-5" open={!!sp.setup}>
        <summary className="cursor-pointer font-semibold">⚙️ How it&apos;s chosen</summary>
        <form action={saveConductingSetup} className="mt-3 space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="label">Who conducts</legend>
            {CONDUCT_MODES.map(([m, label]) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" value={m} defaultChecked={how.mode === m} /> {label}
              </label>
            ))}
          </fieldset>
          <div className="conduct-months space-y-2">
            <div className="label">Each month</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {months.map((d) => (
                <label key={d.toFormat("yyyy-MM")} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0">{d.toFormat("LLLL yyyy")}</span>
                  {personSelect(`month_${d.toFormat("yyyy-MM")}`, how.months[d.toFormat("yyyy-MM")], d.toFormat("LLLL yyyy"))}
                </label>
              ))}
            </div>
          </div>
          <div className="conduct-sundays space-y-2">
            <div className="label">Each Sunday of the month</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ordinal.map((o, i) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0">{o} Sunday</span>
                  {personSelect(`sunday_${i + 1}`, how.sundays[String(i + 1)], `${o} Sunday`)}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="flexible" defaultChecked={how.flexible} className="mt-1" />
            <span>
              <span className="font-medium">Flexible: anyone in the {word} can change who conducts a Sunday</span>
              <span className="block text-muted">Off (a firm schedule): only whoever is scheduled can ask someone else, who has to accept.</span>
            </span>
          </label>
          <SubmitButton>Save</SubmitButton>
        </form>
      </details>
      {missing && (
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {how.mode === "rotation" ? (
            <>
              Some months have no one: set each {word} member&apos;s calling under{" "}
              <Link href="/admin/members" className="underline">
                Admin → Members
              </Link>
              .
            </>
          ) : (
            <>Some Sundays have no one yet: choose who under How it&apos;s chosen.</>
          )}
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
                        {c.insteadOf ? ` (instead of ${c.insteadOf})` : c.calling ? ` · ${c.calling}` : ""}
                      </>
                    ) : how.mode === "rotation" ? (
                      `No ${c.calling} set`
                    ) : (
                      "Not chosen yet"
                    )}
                  </div>
                </div>
                {c.pending && !c.conference && <Badge tone="info">Asked {c.pending.toId === user.id ? "you" : c.pending.toName}</Badge>}
              </div>
              {how.flexible && !c.conference && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-accent">Change who conducts</summary>
                  <form action={changeConductor} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="date" value={c.date} />
                    <select name="to_id" required defaultValue={c.memberId ? String(c.memberId) : ""} className="input flex-1" aria-label="Who conducts">
                      <option value="" disabled>
                        Choose someone…
                      </option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id === user.id ? `${p.name} (me)` : p.name}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn-primary btn-sm" pendingText="Saving…">
                      Save
                    </SubmitButton>
                  </form>
                </details>
              )}
              {!how.flexible && mine && c.pending?.fromId === user.id && (
                <form action={cancelConduct} className="mt-2">
                  <input type="hidden" name="swap_id" value={c.pending.id} />
                  <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                    Withdraw the request
                  </SubmitButton>
                </form>
              )}
              {!how.flexible && mine && !c.pending && (
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
