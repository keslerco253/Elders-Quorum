import Link from "next/link";
import { formatDate } from "@/lib/time";
import { getRequest, validAskToken } from "@/lib/teaching-requests";
import { SubmitButton } from "@/components/client";
import { answerTeachingRequest } from "./actions";

export const metadata = { title: "Will you teach?" };

const DONE: Record<string, [string, string]> = {
  accepted: ["Thank you!", "You're down to teach. You can add notes for the quorum on the lesson page."],
  declined: ["Thanks for letting us know", "The presidency has your answer."],
  taken: ["Already covered", "Someone else is teaching this lesson now. Thank you for being willing!"],
  closed: ["Already answered", "This request was already answered or withdrawn."],
};

export default async function AskPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const token = sp.t ?? "";
  const r = getRequest(id);
  if (!r || !validAskToken(id, r.member_id, token)) {
    return (
      <div className="card space-y-3 text-center">
        <h2 className="h2">This link isn&apos;t valid</h2>
        <p className="text-sm text-muted">Sign in to the app to see your lessons, or contact the presidency.</p>
        <Link href="/login" className="btn-secondary">
          Sign in
        </Link>
      </div>
    );
  }
  const lessonLink = (
    <Link href={`/lessons/${r.lesson_id}`} className="btn-secondary">
      Open the lesson
    </Link>
  );
  const done = sp.done && DONE[sp.done];
  if (done || r.status !== "pending") {
    const [title, text] = done || (r.status === "accepted" ? DONE.accepted : r.status === "declined" ? DONE.declined : DONE.closed);
    return (
      <div className="card space-y-3 text-center">
        <h2 className="h2">{title}</h2>
        <p className="text-sm text-muted">{text}</p>
        {lessonLink}
      </div>
    );
  }
  const hidden = (answer: string) => (
    <>
      <input type="hidden" name="request_id" value={r.id} />
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="answer" value={answer} />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-1">
        <div className="text-sm text-muted">Hi {r.member_name}, {r.asked_by_name ?? "the presidency"} asked if you&apos;d teach</div>
        <h2 className="h2">{r.lesson_title || "Elders quorum lesson"}</h2>
        {r.lesson_speaker && <div className="text-sm text-muted">{r.lesson_speaker}</div>}
        <div className="text-sm">{formatDate(r.lesson_date)}</div>
        {r.message && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">&quot;{r.message}&quot;</p>}
      </div>
      <form action={answerTeachingRequest} className="card">
        {hidden("accept")}
        <SubmitButton className="btn-primary w-full" pendingText="Saving…">
          Yes, I&apos;ll teach
        </SubmitButton>
      </form>
      <details className="card" open={sp.a === "decline"}>
        <summary className="cursor-pointer font-medium">I can&apos;t teach this one</summary>
        <form action={answerTeachingRequest} className="mt-3 space-y-3">
          {hidden("decline")}
          <label className="label" htmlFor="reason">
            Reason (optional, only the presidency sees it)
          </label>
          <input id="reason" name="reason" maxLength={500} className="input" placeholder="e.g. We're out of town that week" autoFocus={sp.a === "decline"} />
          <SubmitButton className="btn-secondary w-full" pendingText="Sending…">
            Send my answer
          </SubmitButton>
        </form>
      </details>
      <p className="text-center text-sm">
        <Link href={`/lessons/${r.lesson_id}`} className="link">
          Read the lesson first
        </Link>
      </p>
    </div>
  );
}
