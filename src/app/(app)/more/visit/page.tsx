import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatPhone } from "@/lib/contact";
import { formatDateTime } from "@/lib/time";
import { myVisitRequests, REQUEST_KINDS, REQUEST_STATUS } from "@/lib/visit-requests";
import { Badge, Flash, PageHeader, Section } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { cancelVisitRequest, requestVisit } from "./actions";

export const metadata = { title: "Request a visit" };

const TONES = { open: "info", scheduled: "success", done: "neutral", closed: "neutral", cancelled: "neutral" } as const;

export default async function VisitRequestPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.ward.timezone;
  const requests = myVisitRequests(user.id);
  const active = requests.find((r) => r.status === "open" || r.status === "scheduled");
  const contact = [user.phone && formatPhone(user.phone), user.email].filter(Boolean).join(" or ");

  return (
    <>
      <PageHeader title="Request a visit" back={{ href: "/more", label: "More" }} subtitle="Would you like someone from the elders quorum presidency to come by, talk, or help? Let us know and we'll reach out." />
      <Flash msg={sp.msg} tone={sp.ok ? "success" : "warn"} />

      {active ? (
        <div className="card mb-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{REQUEST_KINDS[active.kind]}</span>
            <Badge tone={TONES[active.status]}>{REQUEST_STATUS[active.status]}</Badge>
          </div>
          <div className="text-sm text-muted">Sent {formatDateTime(active.created_at, tz, "ccc, LLL d")}</div>
          {active.best_times && <div className="text-sm">Best times: {active.best_times}</div>}
          {active.reply && (
            <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
              <span className="font-semibold">From the presidency:</span> {active.reply}
            </div>
          )}
          {active.status === "open" && <p className="text-sm text-muted">The presidency has your request and will contact you at {contact || "the contact info in your account"}.</p>}
          <form action={cancelVisitRequest}>
            <input type="hidden" name="item_id" value={active.id} />
            <SubmitButton className="btn-secondary btn-sm" confirm="Cancel this request?" pendingText="Cancelling…">
              Cancel request
            </SubmitButton>
          </form>
        </div>
      ) : (
        <form action={requestVisit} className="card mb-5 max-w-2xl space-y-4">
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
            <p className="mt-1 text-xs text-muted">Only the elders quorum presidency can see this. For anything sensitive, you&apos;re welcome to tell us in person instead.</p>
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

      {requests.some((r) => r !== active) && (
        <Section title="Earlier requests">
          <ul className="space-y-2">
            {requests
              .filter((r) => r !== active)
              .map((r) => (
                <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {REQUEST_KINDS[r.kind]} · {formatDateTime(r.created_at, tz, "LLL d")}
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
