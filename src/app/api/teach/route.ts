import { confirmTeaching, lessonForTeacher, validTeachToken } from "@/lib/teaching";

// One-tap "I'll be teaching" from a push notification's button (the service
// worker posts here). Uses the reminder's private token, not a session.
export async function POST(req: Request) {
  const { id, t } = (await req.json().catch(() => ({}))) as { id?: number; t?: string };
  const lesson = id ? lessonForTeacher(Number(id)) : undefined;
  if (!lesson?.teacher_id || !validTeachToken(lesson.id, lesson.teacher_id, String(t ?? ""))) return Response.json({ ok: false }, { status: 403 });
  confirmTeaching(lesson.id, lesson.teacher_id);
  return Response.json({ ok: true });
}
