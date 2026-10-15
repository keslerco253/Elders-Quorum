import { orgTemplate } from "@/lib/templates";
import { notFound } from "next/navigation";
import { requirePresidency } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/time";
import { VISIT_TYPES } from "@/lib/visits";
import { getPlannedVisit, visitorIds } from "@/lib/planned-visits";
import { REQUEST_KINDS, type RequestKind } from "@/lib/visit-requests";
import { firstName } from "@/lib/names";
import { InviteMessage } from "@/components/invite-message";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { cancelPlannedVisit, savePlannedVisit } from "../actions";
import { orgPresidency, orgRoster } from "@/lib/orgs";
import { leadersPhrase } from "@/lib/orgs";

export const metadata = { title: "Plan a visit" };

export default async function PlanVisitPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const sp = await searchParams;
  const d = db();
  const plan = sp.id ? getPlannedVisit(user.org_id, Number(sp.id)) : undefined;
  if (sp.id && !plan) notFound();
  const requestId = plan?.request_id ?? (Number(sp.request) || null);
  const request = requestId
    ? (d.prepare("SELECT r.id, r.member_id, r.kind, r.best_times, m.display_name FROM visit_requests r JOIN members m ON m.id = r.member_id WHERE r.id = ? AND r.org_id = ?").get(requestId, user.org_id) as
        | { id: number; member_id: number; kind: RequestKind; best_times: string; display_name: string }
        | undefined)
    : undefined;
  const memberId = plan?.member_id ?? request?.member_id ?? (Number(sp.member) || undefined);
  const members = orgRoster(user.org_id);
  const presidency = orgPresidency(user.org_id);
  const going = plan ? visitorIds(plan) : [user.id];
  const defaultType = plan?.type ?? (request?.kind === "talk" ? "phone" : "home");
  const inviting = sp.invite === "1";
  const defaultMode = (inviting || (request && !plan) || plan?.invite_status ? "invite" : "none") as "invite" | "datetime" | "none";
  // Members list includes the request's member so the invitation can greet them by name.
  if (request && !members.some((m) => m.id === request.member_id)) members.push({ id: request.member_id, display_name: request.display_name });

  return (
    <>
      <PageHeader title={plan ? "Change planned visit" : inviting ? "Invite to a home visit" : "Plan a visit"} back={{ href: request && !plan ? "/admin/visit-requests" : "/admin/visits", label: request && !plan ? "Visit requests" : "Visits" }} subtitle="It shows under Upcoming visits until you record it. Visible to the presidency only." />
      <Flash msg={sp.msg} tone="danger" />
      {request && (
        <div className="card mb-4 text-sm">
          <span className="font-semibold">{request.display_name}</span> asked for: {REQUEST_KINDS[request.kind]}
          {request.best_times && <div className="text-muted">Best times: {request.best_times}</div>}
        </div>
      )}
      <form id="plan-form" action={savePlannedVisit} className="card max-w-2xl space-y-4">
        {plan && <input type="hidden" name="item_id" value={plan.id} />}
        {request && <input type="hidden" name="request_id" value={request.id} />}
        <div>
          <label className="label" htmlFor="member_id">
            Who to visit
          </label>
          {request ? (
            <>
              <input type="hidden" name="member_id" value={request.member_id} />
              <div className="font-medium">{request.display_name}</div>
            </>
          ) : (
            <select id="member_id" name="member_id" required className="input" defaultValue={memberId ?? ""}>
              <option value="">Choose a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input id="date" name="date" type="date" required min={plan ? undefined : todayIn(user.ward.timezone)} className="input" defaultValue={plan?.date} />
          </div>
          <div>
            <label className="label" htmlFor="time">
              Time
            </label>
            <input id="time" name="time" type="time" className="input" defaultValue={plan?.time ?? "19:00"} />
          </div>
          <div>
            <label className="label" htmlFor="type">
              Kind of visit
            </label>
            <select id="type" name="type" className="input" defaultValue={defaultType}>
              {Object.entries(VISIT_TYPES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">Who&apos;s going</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {presidency.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="visitor_id" value={p.id} defaultChecked={going.includes(p.id)} />
                {p.display_name}
              </label>
            ))}
          </div>
          <p className="hint">They get a reminder the morning of the visit.</p>
        </fieldset>
        <div>
          <label className="label" htmlFor="note">
            Note for the presidency (optional)
          </label>
          <input id="note" name="note" maxLength={1000} className="input" defaultValue={plan?.note} placeholder="e.g. Bring the sacrament meeting program" />
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Let them know</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="notify_mode" value="invite" defaultChecked={defaultMode === "invite"} className="mt-1" />
            <span>
              <strong>Send a personal invitation they can answer</strong>
              <span className="block text-xs text-muted">They can reply &quot;Yes, that works&quot;, suggest another time, or say not right now. You&apos;re notified of their answer.</span>
            </span>
          </label>
          <InviteMessage members={members.map((m) => ({ id: m.id, first: firstName(m.display_name) }))} presidency={presidency.map((p) => ({ id: p.id, name: p.display_name }))} leaders={leadersPhrase(user.org)} template={orgTemplate(user.org_id, "visit_invitation").body} />
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="notify_mode" value="datetime" defaultChecked={defaultMode === "datetime"} className="mt-1" />
            <span>
              Just send the date and time
              <span className="block text-xs text-muted">e.g. &quot;Brother Smith and Brother Jones plan to visit you Tue, Oct 14 at 7:00 PM.&quot; with your names.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="notify_mode" value="none" defaultChecked={defaultMode === "none"} className="mt-1" />
            <span>Don&apos;t send anything (I&apos;ll contact them myself)</span>
          </label>
        </fieldset>
        <SubmitButton pendingText="Saving…">{plan ? "Save changes" : "Plan visit"}</SubmitButton>
      </form>
      {plan && (
        <form action={cancelPlannedVisit} className="mt-4">
          <input type="hidden" name="item_id" value={plan.id} />
          <SubmitButton className="btn-danger btn-sm" confirm="Cancel this planned visit?">
            Cancel planned visit
          </SubmitButton>
        </form>
      )}
    </>
  );
}
