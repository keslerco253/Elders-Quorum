import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { commentThread, getLesson, type CommentView } from "@/lib/lessons";
import { formatDate, formatDateTime } from "@/lib/time";
import { isAdmin } from "@/lib/permissions";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { conferenceLabel } from "@/components/lesson-bits";
import { addComment, deleteOwnComment, saveTeacherNotes, volunteer } from "../actions";
import { getNotes } from "@/lib/lesson-notes";
import { renderMarkdown } from "@/lib/markdown";
import { moderateComment } from "../../admin/comments/actions";

export const metadata = { title: "Lesson" };

export default async function LessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const lesson = getLesson(user.ward_id, Number(id));
  if (!lesson) notFound();
  const conf = conferenceLabel(lesson.kind);
  const volunteered = !!db().prepare("SELECT 1 FROM lesson_volunteers WHERE lesson_id = ? AND member_id = ?").get(lesson.id, user.id);
  const comments = conf ? [] : commentThread(lesson.id, user.id);
  const tz = user.ward.timezone;
  const admin = isAdmin(user);
  const notes = conf ? undefined : getNotes(lesson.id);
  const isTeacher = lesson.teacher_id === user.id;
  const canEditNotes = isTeacher || admin;

  const CommentItem = ({ c, reply }: { c: CommentView; reply?: boolean }) => (
    <div className={reply ? "mt-3 border-l-2 border-border pl-4" : ""}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{c.author}</span>
        <span className="text-xs text-muted">{formatDateTime(c.created_at, tz, "LLL d, h:mm a")}</span>
        {c.status === "pending" && <Badge tone="warn">Waiting for approval</Badge>}
      </div>
      <p className="mt-1 text-[15px] whitespace-pre-wrap">{c.body}</p>
      <div className="mt-1 flex gap-3">
        {c.member_id === user.id && (
          <form action={deleteOwnComment}>
            <input type="hidden" name="item_id" value={c.id} />
            <SubmitButton className="text-xs text-muted hover:text-danger" pendingText="Deleting…" confirm="Delete your comment?">
              Delete
            </SubmitButton>
          </form>
        )}
        {admin && c.member_id !== user.id && c.status === "approved" && (
          <form action={moderateComment}>
            <input type="hidden" name="item_id" value={c.id} />
            <input type="hidden" name="return" value={`/lessons/${lesson.id}#comments`} />
            <SubmitButton name="decision" value="reject" className="text-xs text-muted hover:text-danger" pendingText="Hiding…" confirm="Hide this comment from everyone?">
              Hide
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title={conf ?? (lesson.title || "Talk to be announced")} back={{ href: "/lessons", label: "Lessons" }} subtitle={formatDate(lesson.date)} />
      <Flash msg={sp.msg} />

      {conf ? (
        <div className="card">
          <p>There is no quorum lesson this Sunday. Please attend {conf}.</p>
          {lesson.kind === "general_conference" && (
            <a href="https://www.churchofjesuschrist.org/study/general-conference" className="btn-primary mt-4" target="_blank" rel="noreferrer">
              General Conference in Gospel Library
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="card mb-5 space-y-4">
            {lesson.speaker && <p className="text-muted">{lesson.speaker}</p>}
            {lesson.url ? (
              <a href={lesson.url} target="_blank" rel="noreferrer" className="btn-primary w-full sm:w-auto">
                Read the talk in Gospel Library ↗
              </a>
            ) : (
              <p className="text-sm text-muted">The talk link hasn&apos;t been posted yet.</p>
            )}
            <div className="border-t border-border pt-4">
              <div className="text-sm text-muted">Teacher</div>
              {lesson.teacher_name ? (
                <div className="font-semibold">{lesson.teacher_name}</div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Badge tone="warn">Teacher needed</Badge>
                  <form action={volunteer}>
                    <input type="hidden" name="lesson_id" value={lesson.id} />
                    {volunteered ? (
                      <span className="flex items-center gap-3 text-sm">
                        <span className="text-success">✓ You offered to teach this lesson</span>
                        <SubmitButton name="withdraw" value="1" className="btn-secondary btn-sm">
                          Withdraw
                        </SubmitButton>
                      </span>
                    ) : (
                      <SubmitButton className="btn-secondary btn-sm" pendingText="Sending…">
                        I&apos;d like to teach this
                      </SubmitButton>
                    )}
                  </form>
                </div>
              )}
            </div>
            {admin && (
              <Link href={`/admin/lessons/${lesson.id}`} className="link text-sm">
                Edit lesson
              </Link>
            )}
          </div>

          <section id="notes" className="mb-6 scroll-mt-20">
            {notes?.published_body && (
              <div className="card mb-3 border-accent/40">
                <h2 className="h2 mb-1">Notes from {notes.author ?? "the teacher"}</h2>
                <p className="mb-3 text-xs text-muted">Please read before Sunday.</p>
                <div className="prose-eq" dangerouslySetInnerHTML={{ __html: renderMarkdown(notes.published_body) }} />
              </div>
            )}
            {canEditNotes && notes?.status === "pending" && notes.body !== notes.published_body && (
              <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">The latest notes are waiting for presidency approval.</p>
            )}
            {canEditNotes && notes?.status === "rejected" && (
              <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                Notes sent back for changes{notes.review_note ? `: ${notes.review_note}` : "."}
              </p>
            )}
            {canEditNotes && (
              <details className="card" open={isTeacher && (!notes || notes.status === "rejected")}>
                <summary className="cursor-pointer font-semibold">
                  {notes ? "Edit the lesson notes" : isTeacher ? "You're teaching this lesson: share notes with the quorum" : "Add lesson notes"}
                </summary>
                <form action={saveTeacherNotes} className="mt-3 space-y-3">
                  <input type="hidden" name="lesson_id" value={lesson.id} />
                  <textarea
                    name="notes"
                    rows={8}
                    required
                    maxLength={10000}
                    className="input"
                    defaultValue={notes?.body ?? ""}
                    placeholder={"What should the quorum read or think about before Sunday?\n\n- Read the talk, especially the part about…\n- Come ready to share an experience with…"}
                  />
                  <p className="hint">
                    {admin ? "Saving shares the notes right away." : "A presidency member approves notes before they're shared."} The first time notes are shared, the quorum gets a notification.
                    Use <code>- </code> for bullets and <code>**bold**</code>.
                  </p>
                  <SubmitButton pendingText="Saving…">{admin ? "Save and share" : "Submit for approval"}</SubmitButton>
                </form>
              </details>
            )}
          </section>

          <section id="comments" className="scroll-mt-20">
            <h2 className="h2 mb-1">Study thoughts</h2>
            <p className="mb-4 text-sm text-muted">Share an insight or question from your study. Comments appear after a presidency member approves them.</p>
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="card">
                  <CommentItem c={c} />
                  {c.replies.map((r) => (
                    <CommentItem key={r.id} c={r} reply />
                  ))}
                  {c.status === "approved" && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-accent">Reply</summary>
                      <form action={addComment} className="mt-2 space-y-2">
                        <input type="hidden" name="lesson_id" value={lesson.id} />
                        <input type="hidden" name="parent_id" value={c.id} />
                        <textarea name="body" rows={3} required maxLength={4000} className="input" placeholder={`Reply to ${c.author}`} />
                        <SubmitButton className="btn-primary btn-sm" pendingText="Sending…">
                          Send reply
                        </SubmitButton>
                      </form>
                    </details>
                  )}
                </div>
              ))}
            </div>
            <form action={addComment} className="card mt-4 space-y-3">
              <input type="hidden" name="lesson_id" value={lesson.id} />
              <label className="label" htmlFor="body">
                Add a comment
              </label>
              <textarea id="body" name="body" rows={4} required maxLength={4000} className="input" placeholder="What stood out to you as you studied?" />
              <SubmitButton pendingText="Sending…">Post comment</SubmitButton>
            </form>
          </section>
        </>
      )}
    </>
  );
}
