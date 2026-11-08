import Link from "next/link";
import { requirePresidency } from "@/lib/auth";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { Linkify } from "@/components/linkify";
import { KeepDraft } from "@/components/keep-draft";
import { formatDate, formatDateTime, todayIn } from "@/lib/time";
import { fromCouncil, sharedLately, toShare, type CouncilItem } from "@/lib/ward-council";
import { SectionSelect } from "../section-select";
import { addCouncilItemAction, councilToAgendaAction, deleteCouncilItemAction, editCouncilItemAction, setSharedAction } from "./actions";

export const metadata = { title: "Ward council" };

/**
 * Ward council, for the presidency: what to share there for the whole ward, and what
 * was shared there to pass on to the organization (onto the next presidency meeting's
 * agenda with a tick). Only the presidency sees it.
 */
export default async function WardCouncilPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const share = toShare(user.org_id);
  const shared = sharedLately(user.org_id);
  const from = fromCouncil(user.org_id);

  // Change its wording, or delete it.
  const editable = (i: CouncilItem) => (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-accent">Edit</summary>
      <form action={editCouncilItemAction} className="mt-2 space-y-2">
        <input type="hidden" name="item_id" value={i.id} />
        <input type="hidden" name="kind" value={i.kind} />
        <textarea name="body" rows={3} maxLength={2000} required defaultValue={i.body} className="input text-sm" aria-label="Wording" />
        <div className="flex gap-2">
          <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
        </div>
      </form>
      <form action={deleteCouncilItemAction} className="mt-2">
        <input type="hidden" name="item_id" value={i.id} />
        <input type="hidden" name="kind" value={i.kind} />
        <SubmitButton className="btn-secondary btn-sm" confirm="Delete this?" pendingText="…">
          Delete
        </SubmitButton>
      </form>
    </details>
  );

  return (
    <>
      <PageHeader
        title="Ward council"
        back={{ href: "/admin/meetings", label: "Presidency meetings" }}
        subtitle={`What ${user.orgLabel} will share at ward council, and what to pass on from it. Only the ${user.org.kind === "ward" ? "bishopric" : "presidency"} sees this.`}
      />
      <Flash msg={sp.msg} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section id="share" className="card scroll-mt-20 space-y-3">
          <h2 className="h2">To share at ward council</h2>
          <p className="text-sm text-muted">Things the whole ward council should hear from {user.orgLabel}. Tick each one off once it&apos;s shared.</p>
          <form action={addCouncilItemAction} className="space-y-2">
            <input type="hidden" name="kind" value="share" />
            <KeepDraft id={`council-share:${user.org_id}`} addsTo="data-council-body" />
            <textarea name="body" rows={2} maxLength={2000} required className="input text-sm" placeholder="e.g. The Jones family needs help moving on the 21st" aria-label="Something to share" />
            <SubmitButton className="btn-secondary btn-sm">Add</SubmitButton>
          </form>
          {share.length === 0 ? (
            <Empty>Nothing to share yet.</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {share.map((i) => (
                <li key={i.id} data-council-body={i.body} className="flex items-start gap-3 px-3 py-2.5">
                  <form action={setSharedAction}>
                    <input type="hidden" name="item_id" value={i.id} />
                    <input type="hidden" name="shared" value="1" />
                    <button aria-label="Mark shared" title="Mark shared" className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border-2 border-border hover:border-accent" />
                  </form>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm whitespace-pre-wrap break-words">
                      <Linkify text={i.body} />
                    </div>
                    <div className="text-xs text-muted">
                      {i.adder ? `${i.adder} · ` : ""}
                      {formatDateTime(i.created_at, tz, "LLL d")}
                    </div>
                    {editable(i)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {shared.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Shared lately ({shared.length})</summary>
              <ul className="mt-2 space-y-1.5">
                {shared.map((i) => (
                  <li key={i.id} data-council-body={i.body} className="flex items-start gap-2">
                    <form action={setSharedAction}>
                      <input type="hidden" name="item_id" value={i.id} />
                      <input type="hidden" name="shared" value="0" />
                      <button aria-label="Not shared yet" title="Not shared yet (tap to put it back)" className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 border-success bg-success text-xs text-white">
                        ✓
                      </button>
                    </form>
                    <span className="min-w-0 flex-1 text-muted">
                      {i.body} <span className="text-xs">· shared {formatDateTime(i.shared_at!, tz, "LLL d")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section id="from" className="card scroll-mt-20 space-y-3">
          <h2 className="h2">From ward council</h2>
          <p className="text-sm text-muted">What was shared at ward council that {user.orgLabel} needs to hear or act on.</p>
          <form action={addCouncilItemAction} className="space-y-2">
            <input type="hidden" name="kind" value="from" />
            <KeepDraft id={`council-from:${user.org_id}`} addsTo="data-council-body" />
            <textarea name="body" rows={3} maxLength={2000} required className="input text-sm" placeholder="e.g. Ward Christmas party Dec 12; elders asked to set up tables at 5" aria-label="What was shared" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                Ward council on
                <input type="date" name="council_date" defaultValue={today} className="input w-auto py-1" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="agenda" /> Add to the next presidency meeting agenda
            </label>
            <SectionSelect className="text-sm" />
            <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
          </form>
          {from.length === 0 ? (
            <Empty>Nothing from ward council yet.</Empty>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {from.map((i, n) => (
                <li key={i.id} data-council-body={i.body} className="px-3 py-2.5">
                  {(n === 0 || from[n - 1].council_date !== i.council_date) && i.council_date && (
                    <div className="mb-1 text-xs font-semibold tracking-wide text-accent uppercase">Ward council · {formatDate(i.council_date, "short")}</div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    <Linkify text={i.body} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {i.adder && <span>{i.adder}</span>}
                    <Link
                      href={`/messages/new?${new URLSearchParams({ to: `aud:${user.org_id}:everyone`, title: "From ward council", body: i.body })}`}
                      className="btn-secondary btn-sm"
                    >
                      ✉️ Send to members
                    </Link>
                    <Link href={`/admin/todos?council=${i.id}#assignment-form`} className="btn-secondary btn-sm">
                      📋 Make an assignment
                    </Link>
                    {i.on_agenda ? (
                      <Link href={`/admin/meetings#item-${i.agenda_item_id}`}>
                        <Badge tone="success">On the agenda</Badge>
                      </Link>
                    ) : i.agenda_item_id ? (
                      <Badge>Discussed in a presidency meeting</Badge>
                    ) : (
                      <form action={councilToAgendaAction}>
                        <input type="hidden" name="item_id" value={i.id} />
                        <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                          + Add to the agenda
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                  {editable(i)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
