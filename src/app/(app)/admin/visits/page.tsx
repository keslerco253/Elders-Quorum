import Link from "next/link";
import { DateTime } from "luxon";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { lastVisitByMember, listVisits, VISIT_TYPES } from "@/lib/visits";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { cancelPlannedVisit, markFollowUpDone, markInvitation } from "./actions";
import { openInvitations, upcomingVisits, whenText } from "@/lib/planned-visits";

export const metadata = { title: "Presidency visits" };

export default async function VisitsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const memberId = Number(sp.member) || undefined;
  const view = memberId ? "member" : sp.view === "members" ? "members" : sp.view === "followups" ? "followups" : "recent";
  const member = memberId ? (db().prepare("SELECT display_name FROM members WHERE id = ? AND ward_id = ?").get(memberId, user.ward_id) as { display_name: string } | undefined) : undefined;
  const today = DateTime.fromISO(todayIn(user.ward.timezone));
  const ago = (d: string | null) => {
    if (!d) return null;
    const days = Math.round(today.diff(DateTime.fromISO(d), "days").days);
    if (days < 1) return "today";
    if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
    return `${Math.floor(today.diff(DateTime.fromISO(d), "months").months)} months ago`;
  };
  const tab = (v: string, label: string) => (
    <Link href={`/admin/visits${v === "recent" ? "" : `?view=${v}`}`} className={`rounded-full px-3 py-1 text-sm font-medium ${view === v ? "bg-primary text-primary-text" : "bg-surface-2 text-muted"}`}>
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader
        title={member ? `Visits: ${member.display_name}` : "Presidency visits"}
        back={memberId ? { href: "/admin/visits", label: "All visits" } : { href: "/admin", label: "Admin" }}
        subtitle="Visible to the presidency only."
        actions={
          <>
            <Link href={`/admin/visits/plan${memberId ? `?member=${memberId}` : ""}`} className="btn-primary">
              Plan a visit
            </Link>
            <Link href={`/admin/visits/new${memberId ? `?member=${memberId}` : ""}`} className="btn-secondary">
              Record a visit
            </Link>
          </>
        }
      />
      <Flash msg={sp.msg} />
      {(() => {
        const invites = openInvitations(user.ward_id, memberId);
        if (!invites.length) return null;
        return (
          <section className="mb-6">
            <h2 className="h2 mb-1">Invitations</h2>
            <p className="mb-2 text-sm text-muted">Visits move to Upcoming once the member says yes, or you mark that they did.</p>
            <ul className="space-y-2">
              {invites.map((p) => (
                <li key={p.id} className="card space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/visits?member=${p.member_id}`} className="font-semibold hover:underline">
                      {p.member_name}
                    </Link>
                    {p.invite_status === "pending" && <Badge tone="info">Waiting for a reply</Badge>}
                    {p.invite_status === "new_time" && <Badge tone="warn">Asked for another time</Badge>}
                    {p.invite_status === "declined" && <Badge>Would rather not</Badge>}
                  </div>
                  <div className="text-sm">
                    Invited for <span className="font-medium">{whenText(p.date, p.time)}</span>
                    {p.visitors && <span className="text-muted"> · {p.visitors}</span>}
                  </div>
                  {p.member_reply && (
                    <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      {p.invite_status === "new_time" ? "Better time: " : "They said: "}&quot;{p.member_reply}&quot;
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {p.invite_status !== "declined" && (
                      <Link href={`/admin/visits/plan?id=${p.id}`} className={p.invite_status === "new_time" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
                        {p.invite_status === "new_time" ? "Send a new time" : "Change"}
                      </Link>
                    )}
                    <form action={cancelPlannedVisit}>
                      <input type="hidden" name="item_id" value={p.id} />
                      <SubmitButton className="btn-secondary btn-sm" confirm="Remove this invitation?" pendingText="…">
                        Remove
                      </SubmitButton>
                    </form>
                  </div>
                  {p.invite_status !== "declined" && (
                    <details className="rounded-lg border border-border p-3 text-sm">
                      <summary className="cursor-pointer font-medium">Talked with them? Record their answer</summary>
                      <form action={markInvitation} className="mt-3 space-y-2">
                        <input type="hidden" name="item_id" value={p.id} />
                        <input type="hidden" name="answer" value="accepted" />
                        <div className="font-medium">They said yes</div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" name="date" required defaultValue={p.date} aria-label="Agreed date" className="input" />
                          <input type="time" name="time" defaultValue={p.time ?? ""} aria-label="Agreed time" className="input" />
                        </div>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="confirm" defaultChecked /> Send them a confirmation with the date and time
                        </label>
                        <SubmitButton className="btn-primary btn-sm" pendingText="Saving…">
                          Confirm and move to Upcoming
                        </SubmitButton>
                      </form>
                      <form action={markInvitation} className="mt-4 space-y-2 border-t border-border pt-3">
                        <input type="hidden" name="item_id" value={p.id} />
                        <input type="hidden" name="answer" value="new_time" />
                        <div className="font-medium">They want another time</div>
                        <input name="note" className="input" placeholder="What works for them, e.g. Thursday after 6" />
                        <SubmitButton className="btn-secondary btn-sm" pendingText="Saving…">
                          Save
                        </SubmitButton>
                      </form>
                      <form action={markInvitation} className="mt-4 space-y-2 border-t border-border pt-3">
                        <input type="hidden" name="item_id" value={p.id} />
                        <input type="hidden" name="answer" value="declined" />
                        <div className="font-medium">They&apos;d rather not right now</div>
                        <input name="note" className="input" placeholder="Optional note" />
                        <SubmitButton className="btn-secondary btn-sm" pendingText="Saving…">
                          Save
                        </SubmitButton>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })()}
      {(() => {
        const upcoming = upcomingVisits(user.ward_id, memberId);
        const todayIso = todayIn(user.ward.timezone);
        return (
          <section className="mb-6">
            <h2 className="h2 mb-2">Upcoming visits</h2>
            {upcoming.length === 0 ? (
              <p className="card text-sm text-muted">
                Nothing planned.{" "}
                <Link href={`/admin/visits/plan${memberId ? `?member=${memberId}` : ""}`} className="link">
                  Plan a visit
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((p) => (
                  <li key={p.id} className={`card ${p.date < todayIso ? "border-warn" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/visits?member=${p.member_id}`} className="font-semibold hover:underline">
                            {p.member_name}
                          </Link>
                          {p.date === todayIso && <Badge tone="info">Today</Badge>}
                          {p.date < todayIso && <Badge tone="warn">Not recorded yet</Badge>}
                          {p.request_id && <Badge>Requested</Badge>}
                          {p.invite_status === "pending" && <Badge tone="info">Invited, waiting</Badge>}
                          {p.invite_status === "accepted" && <Badge tone="success">✓ Confirmed</Badge>}
                          {p.invite_status === "new_time" && <Badge tone="warn">Asked for another time</Badge>}
                          {p.invite_status === "declined" && <Badge tone="warn">Said not right now</Badge>}
                        </div>
                        <div className="text-sm font-medium">{whenText(p.date, p.time)}</div>
                        <div className="text-sm text-muted">
                          {VISIT_TYPES[p.type]}
                          {p.visitors && ` · ${p.visitors}`}
                        </div>
                        {p.note && <div className="mt-1 text-sm">{p.note}</div>}
                        {p.member_reply && (
                          <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                            {/* Confirmed by the presidency (e.g. by phone) vs. the member's own words. */}
                            {p.member_reply.startsWith("Arranged by ") ? p.member_reply : <>They said: &quot;{p.member_reply}&quot;</>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/admin/visits/new?plan=${p.id}`} className="btn-primary btn-sm">
                        Record visit
                      </Link>
                      <Link href={`/admin/visits/plan?id=${p.id}`} className={p.invite_status === "new_time" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
                        {p.invite_status === "new_time" ? "Pick a new time" : "Change"}
                      </Link>
                      <form action={cancelPlannedVisit}>
                        <input type="hidden" name="item_id" value={p.id} />
                        <SubmitButton className="btn-secondary btn-sm" confirm="Cancel this planned visit?" pendingText="…">
                          Cancel
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })()}
      <h2 className="h2 mb-2">Visits made</h2>
      {!memberId && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tab("recent", "Recent")}
          {tab("members", "By member")}
          {tab("followups", "Follow-ups")}
        </div>
      )}

      {view === "members" ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {lastVisitByMember(user.ward_id).map((m) => (
            <li key={m.id}>
              <Link href={`/admin/visits?member=${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.display_name}</div>
                </div>
                {m.last_home ? (
                  <span className="text-right text-sm">
                    {formatDate(m.last_home, "short")}
                    <span className="block text-xs text-muted">{ago(m.last_home)}</span>
                  </span>
                ) : (
                  <Badge tone="warn">No home visit</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        (() => {
          const visits = listVisits(user.ward_id, { memberId, followUps: view === "followups" });
          if (!visits.length) return <Empty>{view === "followups" ? "No open follow-ups." : "No visits recorded yet."}</Empty>;
          return (
            <ul className="space-y-3">
              {visits.map((v) => (
                <li key={v.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/admin/visits?member=${v.member_id}`} className="font-semibold hover:underline">
                        {v.member_name}
                      </Link>
                      <div className="text-sm text-muted">
                        {formatDate(v.date)} · {VISIT_TYPES[v.type]}
                      </div>
                      <div className="text-sm text-muted">By {v.visitors}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!!v.follow_up && (v.follow_up_done ? <Badge tone="success">Followed up</Badge> : <Badge tone="warn">Follow-up needed</Badge>)}
                      <Link href={`/admin/visits/${v.id}`} className="btn-secondary btn-sm">
                        Edit
                      </Link>
                    </div>
                  </div>
                  {v.notes && <p className="mt-2 text-sm whitespace-pre-wrap">{v.notes}</p>}
                  {!!v.follow_up && !v.follow_up_done && (
                    <form action={markFollowUpDone} className="mt-2">
                      <input type="hidden" name="item_id" value={v.id} />
                      <SubmitButton className="btn-secondary btn-sm">Mark follow-up done</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          );
        })()
      )}
    </>
  );
}
