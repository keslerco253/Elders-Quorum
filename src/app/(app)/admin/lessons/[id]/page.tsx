import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLesson } from "@/lib/lessons";
import { isPresidency } from "@/lib/permissions";
import { formatDate } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { assignTeacher, deleteLesson, saveLesson } from "../actions";

export const metadata = { title: "Edit lesson" };

export default async function EditLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const lesson = getLesson(user.ward_id, Number(id));
  if (!lesson) notFound();
  const presidency = isPresidency(user);
  const volunteers = db()
    .prepare("SELECT m.id, m.display_name FROM lesson_volunteers v JOIN members m ON m.id = v.member_id WHERE v.lesson_id = ? ORDER BY v.created_at")
    .all(lesson.id) as { id: number; display_name: string }[];
  const members = db().prepare("SELECT id, display_name FROM members WHERE ward_id = ? AND status = 'active' ORDER BY display_name").all(user.ward_id) as { id: number; display_name: string }[];
  const declines = presidency
    ? (db()
        .prepare("SELECT d.id, m.display_name, d.reason, d.created_at FROM lesson_declines d JOIN members m ON m.id = d.member_id WHERE d.lesson_id = ? ORDER BY d.id DESC")
        .all(lesson.id) as { id: number; display_name: string; reason: string; created_at: string }[])
    : [];

  return (
    <>
      <PageHeader title={formatDate(lesson.date)} back={{ href: "/admin/lessons", label: "Manage lessons" }} actions={<Link href={`/lessons/${lesson.id}`} className="btn-secondary">View as member</Link>} />
      <Flash msg={sp.msg} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <form action={saveLesson} className="card space-y-4">
          <input type="hidden" name="item_id" value={lesson.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="kind">
                This Sunday is
              </label>
              <select id="kind" name="kind" defaultValue={lesson.kind} className="input">
                <option value="talk">A lesson on a talk</option>
                <option value="general_conference">General Conference (no lesson)</option>
                <option value="stake_conference">Stake Conference (no lesson)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="date">
                Date
              </label>
              <input id="date" name="date" type="date" defaultValue={lesson.date} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="url">
              Talk link (Gospel Library)
            </label>
            <input id="url" name="url" type="url" defaultValue={lesson.url} className="input" placeholder="https://www.churchofjesuschrist.org/study/general-conference/…" />
            <p className="hint">Leave the title and speaker blank to look them up from the link.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="title">
                Talk title
              </label>
              <input id="title" name="title" defaultValue={lesson.title} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="speaker">
                Speaker
              </label>
              <input id="speaker" name="speaker" defaultValue={lesson.speaker} className="input" />
            </div>
          </div>
          <SubmitButton>Save lesson</SubmitButton>
        </form>

        <div className="space-y-4">
          {lesson.kind === "talk" && (
            <div className="card space-y-3">
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
