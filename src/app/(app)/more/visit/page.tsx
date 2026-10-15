import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { myVisitRequests, REQUEST_KINDS, REQUEST_STATUS } from "@/lib/visit-requests";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { cancelVisitRequest, requestVisit } from "./actions";
import { hasFeature, leadersPhrase, myOrgs } from "@/lib/orgs";

export const metadata = { title: "Request a visit" };

const TONES = { open: "info", scheduled: "success", done: "neutral", closed: "neutral", cancelled: "neutral" } as const;

export default async function VisitRequestPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const requests = myVisitRequests(user.id);
  const isActive = (r: { status: string }) => r.status === "open" || r.status === "scheduled";
  const actives = requests.filter(isActive);
  const contact = [user.phone && formatPhone(user.phone), user.email].filter(Boolean).join(" or ");
  // Who they can ask: the organizations they belong to that do visits, and the bishopric.
  // One open request per organization at a time.
  const orgs = myOrgs(user.id).filter((o) => hasFeature(o, "visits"));
  const choices = orgs.filter((o) => !actives.some((r) => r.org_id === o.id));
  const preferred = choices.find((o) => o.id === user.org_id) ?? choices.find((o) => o.kind === "group") ?? choices[0];
  const who = (orgId: number) => {
    const o = orgs.find((x) => x.id === orgId);
    return o ? leadersPhrase(o).replace(/^the /, "The ") : "The presidency";
  };

  return (
    <>
      <PageHeader title="Request a visit" back={{ href: "/more", label: "More" }} subtitle={`Would you like ${orgs.length === 1 ? leadersPhrase(orgs[0]) : "your leaders"} to come by, talk, or help? Let us know and we'll reach out.`} />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />

      {actives.map((active) => (
        <div key={active.id} className="card mb-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{REQUEST_KINDS[active.kind]}</span>
            <Badge tone={TONES[active.status]}>{REQUEST_STATUS[active.status]}</Badge>
          </div>
          <div className="text-sm text-muted">
            To {who(active.org_id).replace(/^The /, "the ")} · sent {formatDateTime(active.created_at, tz, "ccc, LLL d")}
          </div>
          {active.best_times && <div className="text-sm">Best times: {active.best_times}</div>}
          {active.reply && (
            <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
              <span className="font-semibold">From {who(active.org_id).replace(/^The /, "the ")}:</span> {active.reply}
            </div>
          )}
          {active.status === "open" && (
            <p className="text-sm text-muted">
              {who(active.org_id)} has your request and will contact you at {contact || "the contact info in your account"}.
            </p>
          )}
          <form action={cancelVisitRequest}>
            <input type="hidden" name="item_id" value={active.id} />
            <SubmitButton className="btn-secondary btn-sm" confirm="Cancel this request?" pendingText="Cancelling…">
              Cancel request
            </SubmitButton>
          </form>
        </div>
      ))}

      {choices.length === 0 ? (
        orgs.length === 0 && <p className="card mb-5 text-sm text-muted">None of your organizations take visit requests in the app right now.</p>
      ) : (
        <form action={requestVisit} className="card mb-5 max-w-2xl space-y-4">
          {choices.length === 1 ? (
            <>
              <input type="hidden" name="org_id" value={choices[0].id} />
              <p className="text-sm">
                To <span className="font-semibold">{who(choices[0].id).replace(/^The /, "the ")}</span>
              </p>
            </>
          ) : (
            <fieldset>
              <legend className="label">Who would you like to hear from?</legend>
              <div className="space-y-2">
                {choices.map((o) => (
                  <label key={o.id} className="flex items-center gap-2">
                    <input type="radio" name="org_id" value={o.id} defaultChecked={o.id === preferred?.id} required />
                    {who(o.id)}
                    {o.kind === "ward" && orgs.filter((x) => x.kind === "ward").length === 1 ? "" : o.kind === "ward" ? ` (${o.label})` : ""}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="label">What would you like?</legend>
            <div className="space-y-2">
              {Object.entries(REQUEST_KINDS).map(([k, label], i) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="kind" value={k} defaultChecked={i === 0} required />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="best_times">
              Best days or times (optional)
            </label>
            <input id="best_times" name="best_times" maxLength={200} className="input" placeholder="e.g. Weekday evenings after 6" />
          </div>
          <div>
            <label className="label" htmlFor="note">
              Anything you&apos;d like us to know (optional)
            </label>
            <textarea id="note" name="note" rows={3} maxLength={1000} className="input" />
            <p className="mt-1 text-xs text-muted">Only the leaders you choose above can see this. For anything sensitive, you&apos;re welcome to tell us in person instead.</p>
          </div>
          <p className="text-sm text-muted">
            We&apos;ll reach you at {contact || "the contact info in your account"}.{" "}
            <Link href="/more/contact" className="link">
              Update
            </Link>
          </p>
          <SubmitButton pendingText="Sending…">Send request</SubmitButton>
        </form>
      )}

      {requests.some((r) => !isActive(r)) && (
        <Section title="Earlier requests">
          <ul className="space-y-2">
            {requests
              .filter((r) => !isActive(r))
              .map((r) => (
                <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {REQUEST_KINDS[r.kind]} · {who(r.org_id)} · {formatDateTime(r.created_at, tz, "LLL d")}
                  </span>
                  <Badge tone={TONES[r.status]}>{REQUEST_STATUS[r.status]}</Badge>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </>
  );
}
