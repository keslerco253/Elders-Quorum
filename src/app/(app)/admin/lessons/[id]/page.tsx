import Link from "next/link";
import { requestsForLesson } from "@/lib/teaching-requests";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLesson } from "@/lib/lessons";
import { isPresidency } from "@/lib/permissions";
import { formatDate, todayIn } from "@/lib/time";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { LessonFields } from "./lesson-fields";
import { SubmitButton } from "@/components/client";
import { askTeacher, assignTeacher, cancelTeachingRequest, deleteLesson, refillFromCfm, saveLesson } from "../actions";
import { cfmWeekOn, usesCfm } from "@/lib/cfm";
import { orgRoster } from "@/lib/orgs";

export const metadata = { title: "Edit lesson" };

export default async function EditLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const lesson = getLesson(user.org_id, Number(id));
  if (!lesson) notFound();
  const presidency = isPresidency(user);
  // Sunday School: that week's Come, Follow Me lesson.
  const cfm = usesCfm(user.org);
  const week = cfm ? cfmWeekOn(lesson.date) : undefined;
  const volunteers = db()
    .prepare("SELECT m.id, m.display_name FROM lesson_volunteers v JOIN members m ON m.id = v.member_id WHERE v.lesson_id = ? ORDER BY v.created_at")
    .all(lesson.id) as { id: number; display_name: string }[];
  const members = orgRoster(user.org_id);
  const requests = presidency ? requestsForLesson(lesson.id) : [];
  const declines = presidency
    ? (db()
        .prepare("SELECT d.id, m.display_name, d.reason, d.created_at FROM lesson_declines d JOIN members m ON m.id = d.member_id WHERE d.lesson_id = ? ORDER BY d.id DESC")
        .all(lesson.id) as { id: number; display_name: string; reason: string; created_at: string }[])
    : [];

  return (
    <>
      <PageHeader title={formatDate(lesson.date)} back={{ href: "/admin/lessons", label: "Manage lessons" }} actions={<Link href={`/lessons/${lesson.id}`} className="btn-secondary">View as member</Link>} />
      <Flash msg={sp.msg} />
      {week && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <div className="font-medium">Come, Follow Me this week: {week.reading}</div>
            <div className="text-muted">
              {lesson.cfm_auto ? "This lesson was filled from it. Change anything below and it stays as you set it." : "This lesson has been changed by hand."}
            </div>
          </div>
          {!lesson.cfm_auto && (
            <form action={refillFromCfm}>
              <input type="hidden" name="item_id" value={lesson.id} />
              <SubmitButton className="btn-secondary btn-sm" confirm="Put this Sunday back to the Come, Follow Me lesson?">
                Refill from Come, Follow Me
              </SubmitButton>
            </form>
          )}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Keyed on the lesson, so it shows the new values after a refill. */}
        <form key={`${lesson.kind}|${lesson.topic}|${lesson.date}|${lesson.title}|${lesson.speaker}|${lesson.url}`} action={saveLesson} className="card space-y-4">
          <input type="hidden" name="item_id" value={lesson.id} />
          <LessonFields kind={lesson.topic ? "topic" : lesson.kind} date={lesson.date} url={lesson.url} title={lesson.title} speaker={lesson.speaker} cfm={cfm} />
          <SubmitButton>Save lesson</SubmitButton>
        </form>

        <div className="space-y-4">
          {lesson.kind === "talk" && (
            <div id="teacher" className="card scroll-mt-20 space-y-3">
              <h2 className="h2">Teacher</h2>
              {lesson.teacher_name && (
                <p className="text-sm">
                  <span className="font-medium">{lesson.teacher_name}</span>{" "}
                  {lesson.teacher_confirmed_at ? (
                    <span className="text-success">✓ confirmed they&apos;re teaching</span>
                  ) : (
                    <span className="text-muted">hasn&apos;t confirmed yet (their reminders ask)</span>
                  )}
                </p>
              )}
              {presidency ? (
                <>
                  {declines.length > 0 && (
                    <div className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                      {declines.map((d) => (
                        <div key={d.id}>
                          <strong>{d.display_name}</strong> can&apos;t teach{d.reason ? `: ${d.reason}` : "."}
                        </div>
                      ))}
                    </div>
                  )}
                  {volunteers.length > 0 && (
                    <div>
                      <div className="mb-2 text-sm text-muted">Volunteered to teach:</div>
                      <ul className="space-y-2">
                        {volunteers.map((v) => (
                          <li key={v.id} className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {v.display_name}
                              {lesson.teacher_id === v.id && <span className="ml-2 text-success">✓ assigned</span>}
                            </span>
                            {lesson.teacher_id !== v.id && (
                              <form action={assignTeacher}>
                                <input type="hidden" name="lesson_id" value={lesson.id} />
                                <input type="hidden" name="teacher_id" value={v.id} />
                                <SubmitButton className="btn-primary btn-sm">Assign</SubmitButton>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <form action={assignTeacher} className="space-y-2 border-t border-border pt-3">
                    <input type="hidden" name="lesson_id" value={lesson.id} />
                    <label className="label" htmlFor="teacher_id">
                      Assign anyone
                    </label>
                    <select id="teacher_id" name="teacher_id" defaultValue={lesson.teacher_id ?? ""} className="input">
                      <option value="">(no teacher)</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn-secondary btn-sm">Save teacher</SubmitButton>
                    <p className="hint">The new teacher gets a notification.</p>
                  </form>
                  {lesson.date >= todayIn(user.ward.timezone) && (
                    <form id="ask" action={askTeacher} className="scroll-mt-20 space-y-2 border-t border-border pt-3">
                      <input type="hidden" name="lesson_id" value={lesson.id} />
                      <label className="label" htmlFor="ask_member">
                        Ask someone to teach
                      </label>
                      <select id="ask_member" name="member_id" required defaultValue="" className="input">
                        <option value="">Choose a member…</option>
                        {members
                          .filter((m) => m.id !== lesson.teacher_id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                      </select>
                      <input name="message" maxLength={500} className="input" placeholder="Optional note, e.g. We'd love to have you teach this one." />
                      <SubmitButton className="btn-primary btn-sm" pendingText="Sending…">
                        Send request
                      </SubmitButton>
                      <p className="hint">They can accept (and are assigned) or decline with a reason. You&apos;re notified either way.</p>
                    </form>
                  )}
                  {requests.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <div className="text-sm text-muted">Asked to teach:</div>
                      <ul className="space-y-2 text-sm">
                        {requests.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              <span className="font-medium">{r.member_name}</span>{" "}
                              {r.status === "pending" && <Badge tone="info">Waiting for answer</Badge>}
                              {r.status === "accepted" && <Badge tone="success">Accepted</Badge>}
                              {r.status === "declined" && <Badge tone="warn">Declined</Badge>}
                              {r.status === "cancelled" && <Badge>Withdrawn</Badge>}
                              {r.reason && <span className="block text-muted">&quot;{r.reason}&quot;</span>}
                            </span>
                            {r.status === "pending" && (
                              <form action={cancelTeachingRequest}>
                                <input type="hidden" name="item_id" value={r.id} />
                                <input type="hidden" name="lesson_id" value={lesson.id} />
                                <SubmitButton className="btn-secondary btn-sm" confirm="Withdraw this request?" pendingText="…">
                                  Withdraw
                                </SubmitButton>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm">
                  {lesson.teacher_name ?? "No teacher assigned."}
                  {volunteers.length > 0 && <span className="block text-muted">Volunteers: {volunteers.map((v) => v.display_name).join(", ")}</span>}
                  <span className="hint block">The presidency assigns teachers.</span>
                </p>
              )}
            </div>
          )}
          <form action={deleteLesson} className="card">
            <input type="hidden" name="item_id" value={lesson.id} />
            <SubmitButton className="btn-danger btn-sm" confirm="Delete this lesson and its comments?">
              Delete this Sunday
            </SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}
