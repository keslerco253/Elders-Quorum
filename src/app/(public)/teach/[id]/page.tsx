import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { orgTimezone } from "@/lib/orgs";
import { lessonForTeacher, validTeachToken } from "@/lib/teaching";
import { SubmitButton } from "@/components/client";
import { respondTeaching } from "./actions";

export const metadata = { title: "Your lesson" };

export default async function TeachReplyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const token = sp.t ?? "";
  const lesson = lessonForTeacher(id);

  if (sp.done && lesson && validTeachToken(id, Number(sp.m), token)) {
    return (
      <div className="card space-y-3 text-center">
        <h2 className="h2">{sp.done === "cant" ? "Thanks for letting us know" : "Thanks for confirming!"}</h2>
        <p className="text-sm text-muted">
          {sp.done === "cant" ? "The presidency has been told and will find another teacher." : `You're teaching ${formatDate(lesson.date)}. See you Sunday!`}
        </p>
        <Link href={`/lessons/${id}`} className="btn-secondary">
          Open the lesson
        </Link>
      </div>
    );
  }

  const teacherId = lesson?.teacher_id ?? 0;
  const valid = !!lesson && !!teacherId && validTeachToken(id, teacherId, token);
  const today = lesson ? new Date().toLocaleDateString("en-CA", { timeZone: orgTimezone(lesson.org_id) }) : "";
  if (!valid || !lesson || lesson.date < today) {
    return (
      <div className="card space-y-3 text-center">
        <h2 className="h2">This link has expired</h2>
        <p className="text-sm text-muted">{lesson && lesson.date < today ? "That lesson has already happened." : "You may no longer be the teacher for this lesson. Sign in to see the lesson, or contact the presidency."}</p>
        <Link href="/login" className="btn-secondary">
          Sign in
        </Link>
      </div>
    );
  }
  const teacher = db().prepare("SELECT display_name FROM members WHERE id = ?").get(teacherId) as { display_name: string };

  return (
    <div className="space-y-4">
      <div className="card space-y-1">
        <div className="text-sm text-muted">Hi {teacher.display_name}, you&apos;re teaching</div>
        <h2 className="h2">{lesson.title || "Sunday's lesson"}</h2>
        <div className="text-sm">{formatDate(lesson.date)}</div>
        {lesson.teacher_confirmed_at && <div className="pt-1 text-sm text-success">✓ You confirmed you&apos;re teaching.</div>}
      </div>
      {!lesson.teacher_confirmed_at && (
        <form action={respondTeaching} className="card">
          <input type="hidden" name="lesson_id" value={id} />
          <input type="hidden" name="teacher_id" value={teacherId} />
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="answer" value="teach" />
          <SubmitButton className="btn-primary w-full" pendingText="Saving…">
            Yes, I&apos;m still teaching
          </SubmitButton>
        </form>
      )}
      <details className="card" open={sp.a === "cant"}>
        <summary className="cursor-pointer font-medium">I can&apos;t teach this lesson</summary>
        <form action={respondTeaching} className="mt-3 space-y-3">
          <input type="hidden" name="lesson_id" value={id} />
          <input type="hidden" name="teacher_id" value={teacherId} />
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="answer" value="cant" />
          <label className="label" htmlFor="reason">
            Reason (optional, only the presidency sees it)
          </label>
          <input id="reason" name="reason" maxLength={500} className="input" placeholder="e.g. Out of town that weekend" autoFocus={sp.a === "cant"} />
          <SubmitButton className="btn-danger w-full" confirm="Let the presidency know you can't teach?" pendingText="Sending…">
            I can&apos;t teach this lesson
          </SubmitButton>
          <p className="hint">You&apos;ll be taken off this lesson, any teacher notes you posted for it are removed, and the presidency will find another teacher.</p>
        </form>
      </details>
      <p className="text-center text-sm">
        <Link href={`/lessons/${id}`} className="link">
          Open the lesson in the app
        </Link>
      </p>
    </div>
  );
}
