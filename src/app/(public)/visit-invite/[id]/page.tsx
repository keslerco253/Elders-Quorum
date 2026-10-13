import { db } from "@/lib/db";
import { getPlannedVisit, validInviteToken, whenText } from "@/lib/planned-visits";
import { SubmitButton } from "@/components/client";
import { replyToInvitation } from "./actions";

export const metadata = { title: "A visit invitation" };

const DONE: Record<string, [string, string]> = {
  accepted: ["Wonderful! We'll see you then.", "Thank you. We're looking forward to visiting with you and your family."],
  new_time: ["Thank you!", "We'll look at the time you suggested and get back to you."],
  declined: ["Thank you for letting us know", "We understand. If there's ever anything we can do, please reach out."],
};

export default async function VisitInvitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const token = sp.t ?? "";
  const ward = db().prepare("SELECT ward_id FROM planned_visits WHERE id = ?").get(id) as { ward_id: number } | undefined;
  const plan = ward ? getPlannedVisit(ward.ward_id, id) : undefined;
  if (!plan || !validInviteToken(id, plan.member_id, token) || !plan.invite_status) {
    return (
      <div className="card space-y-2 text-center">
        <h2 className="h2">This invitation isn&apos;t available</h2>
        <p className="text-sm text-muted">It may have been changed or cancelled. Please reach out to the elders quorum presidency.</p>
      </div>
    );
  }
  const answered = sp.done ?? (plan.invite_status !== "pending" ? plan.invite_status : null);
  if (answered && DONE[answered]) {
    const [title, text] = DONE[answered];
    return (
      <div className="card space-y-2 text-center">
        <h2 className="h2">{title}</h2>
        <p className="text-sm text-muted">{text}</p>
        {answered === "accepted" && <p className="text-sm font-semibold">{whenText(plan.date, plan.time)}</p>}
      </div>
    );
  }
  const hidden = (answer: string) => (
    <>
      <input type="hidden" name="plan_id" value={plan.id} />
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="answer" value={answer} />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{plan.invite_message}</p>
        <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <div className="font-semibold">{whenText(plan.date, plan.time)}</div>
          {plan.visitors && <div className="text-muted">{plan.visitors}</div>}
        </div>
      </div>
      <form action={replyToInvitation} className="card">
        {hidden("accepted")}
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">
          Yes, that works for us
        </SubmitButton>
      </form>
      <details className="card" open={sp.a === "new_time"}>
        <summary className="cursor-pointer font-medium">That time doesn&apos;t work</summary>
        <form action={replyToInvitation} className="mt-3 space-y-3">
          {hidden("new_time")}
          <label className="label" htmlFor="reply">
            What day or time would work better?
          </label>
          <input id="reply" name="reply" required maxLength={500} className="input" placeholder="e.g. Thursday evening after 6, or any Sunday afternoon" />
          {sp.err && <p className="text-sm text-danger">Please let us know a time that would work.</p>}
          <SubmitButton className="btn-primary w-full" pendingText="Sending…">
            Suggest this time
          </SubmitButton>
        </form>
      </details>
      <details className="card">
        <summary className="cursor-pointer font-medium">Not right now</summary>
        <form action={replyToInvitation} className="mt-3 space-y-3">
          {hidden("declined")}
          <label className="label" htmlFor="note">
            Anything you&apos;d like us to know? (optional)
          </label>
          <input id="note" name="reply" maxLength={500} className="input" />
          <SubmitButton className="btn-secondary w-full" pendingText="Sending…">
            Send
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
