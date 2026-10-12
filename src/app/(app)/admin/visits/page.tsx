import Link from "next/link";
import { DateTime } from "luxon";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { lastVisitByMember, listVisits, VISIT_TYPES } from "@/lib/visits";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { markFollowUpDone } from "./actions";

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
          <Link href={`/admin/visits/new${memberId ? `?member=${memberId}` : ""}`} className="btn-primary">
            Record a visit
          </Link>
        }
      />
      <Flash msg={sp.msg} />
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
