import { requirePresidency } from "@/lib/auth";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { REQUEST_KINDS, REQUEST_STATUS, wardVisitRequests } from "@/lib/visit-requests";
import { Badge, Empty, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { closeVisitRequest, markRequestVisited, replyToVisitRequest } from "./actions";

export const metadata = { title: "Visit requests" };

export default async function VisitRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const active = wardVisitRequests(user.ward_id, true);
  const past = wardVisitRequests(user.ward_id, false);

  return (
    <>
      <PageHeader title="Visit requests" back={{ href: "/admin", label: "Admin" }} subtitle="Members asking the presidency for a visit. Only the presidency can see these." />
      <Flash msg={sp.msg} />
      {active.length === 0 ? (
        <Empty>No visit requests right now.</Empty>
      ) : (
        <div className="space-y-3">
          {active.map((r) => (
            <div key={r.id} className="card space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.member_name}</span>
                <Badge tone={r.status === "open" ? "warn" : "success"}>{r.status === "open" ? "New" : "Scheduled"}</Badge>
              </div>
              <div className="text-sm">{REQUEST_KINDS[r.kind]}</div>
              <div className="text-sm text-muted">
                Asked {formatDateTime(r.created_at, tz, "ccc, LLL d")}
                {r.best_times && ` · Best times: ${r.best_times}`}
              </div>
              <div className="flex flex-wrap gap-x-4 text-sm">
                {r.phone && (
                  <a className="link" href={`tel:${r.phone}`}>
                    {formatPhone(r.phone)}
                  </a>
                )}
                {r.phone && (
                  <a className="link" href={`sms:${r.phone}`}>
                    Text
                  </a>
                )}
                {r.email && (
                  <a className="link" href={`mailto:${r.email}`}>
                    {r.email}
                  </a>
                )}
              </div>
              {r.note && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">{r.note}</p>}
              {r.reply && (
                <p className="text-sm text-muted">
                  Reply sent{r.handled_by_name && ` by ${r.handled_by_name}`}: {r.reply}
                </p>
              )}
              <form action={replyToVisitRequest} className="space-y-2 border-t border-border pt-3">
                <input type="hidden" name="item_id" value={r.id} />
                <label className="label" htmlFor={`reply-${r.id}`}>
                  Reply to {r.member_name.split(" ")[0]}
                </label>
                <input id={`reply-${r.id}`} name="reply" maxLength={500} className="input" placeholder="e.g. Brother Smith and I can come Tuesday at 7 PM. Does that work?" />
                <SubmitButton className="btn-primary btn-sm" pendingText="Sending…">
                  Send reply
                </SubmitButton>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action={markRequestVisited}>
                  <input type="hidden" name="item_id" value={r.id} />
                  <SubmitButton className="btn-secondary btn-sm" pendingText="Saving…">
                    Mark visited
                  </SubmitButton>
                </form>
                <form action={closeVisitRequest}>
                  <input type="hidden" name="item_id" value={r.id} />
                  <SubmitButton className="btn-secondary btn-sm" confirm="Close without a visit?" pendingText="Closing…">
                    Close
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <Section title="Recently finished">
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface text-sm">
            {past.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  {r.member_name} · {REQUEST_KINDS[r.kind]} · {formatDateTime(r.created_at, tz, "LLL d")}
                </span>
                <Badge>{REQUEST_STATUS[r.status]}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Finished requests are deleted automatically after 30 days.</p>
        </Section>
      )}
    </>
  );
}
