import { db } from "./db";
import { removeTeacherNotes } from "./lesson-notes";
import { notify, recipientById } from "./notify";

// Regular teachers: "Brother Smith teaches every 3rd Sunday". Each of the 1st-4th Sundays
// of the month has at most one (so two people never share a Sunday); someone can have
// more than one (2nd and 4th). 5th Sundays have no regular teacher.

export const WEEKS = [1, 2, 3, 4] as const;
export const WEEK_WORDS = ["1st", "2nd", "3rd", "4th", "5th"];

/** Which Sunday of its month a date is (1-5). */
export const weekOfMonth = (iso: string) => Math.ceil(Number(iso.slice(8, 10)) / 7);

/** "1st and 3rd Sundays", "2nd Sunday". */
export function weeksText(weeks: number[]): string {
  const w = [...weeks].sort().map((n) => WEEK_WORDS[n - 1]);
  const list = w.length > 1 ? `${w.slice(0, -1).join(", ")} and ${w.at(-1)}` : w[0];
  return `${list} Sunday${w.length > 1 ? "s" : ""}`;
}

export interface RegularTeacher {
  week: number;
  member_id: number;
  display_name: string;
}

export function regularTeachers(orgId: number): RegularTeacher[] {
  return db()
    .prepare("SELECT r.week, r.member_id, m.display_name FROM regular_teachers r JOIN members m ON m.id = r.member_id WHERE r.org_id = ? ORDER BY r.week")
    .all(orgId) as RegularTeacher[];
}

/** Each regular teacher with all their Sundays. */
export function regularByTeacher(orgId: number): { member_id: number; display_name: string; weeks: number[] }[] {
  const by = new Map<number, { member_id: number; display_name: string; weeks: number[] }>();
  for (const r of regularTeachers(orgId)) {
    const t = by.get(r.member_id) ?? { member_id: r.member_id, display_name: r.display_name, weeks: [] };
    t.weeks.push(r.week);
    by.set(r.member_id, t);
  }
  return [...by.values()];
}

/**
 * Puts regular teachers on upcoming lessons that don't have a teacher yet. Each lesson
 * is filled once: if the teacher is taken off or says they can't, it isn't filled again.
 * Skips conferences, 5th Sundays, lessons someone has been asked to teach, and teachers
 * no longer active in the organization. Returns how many lessons were filled.
 */
export function fillRegularTeachers(orgId: number, today: string): number {
  const d = db();
  const byWeek = new Map(
    (
      d
        .prepare(
          `SELECT r.week, r.member_id FROM regular_teachers r JOIN members m ON m.id = r.member_id
           JOIN org_members om ON om.org_id = r.org_id AND om.member_id = r.member_id WHERE r.org_id = ? AND m.status = 'active'`,
        )
        .all(orgId) as { week: number; member_id: number }[]
    ).map((r) => [r.week, r.member_id]),
  );
  if (!byWeek.size) return 0;
  const lessons = d
    .prepare(
      `SELECT l.id, l.date FROM lessons l WHERE l.org_id = ? AND l.date >= ? AND l.kind = 'talk' AND l.teacher_id IS NULL AND l.regular_done = 0
         AND NOT EXISTS (SELECT 1 FROM teaching_requests r WHERE r.lesson_id = l.id AND r.status = 'pending')`,
    )
    .all(orgId, today) as { id: number; date: string }[];
  const declined = d.prepare("SELECT 1 FROM lesson_declines WHERE lesson_id = ? AND member_id = ?");
  const set = d.prepare("UPDATE lessons SET teacher_id = ?, teacher_confirmed_at = NULL, teacher_auto = 1, regular_done = 1 WHERE id = ? AND teacher_id IS NULL");
  const skip = d.prepare("UPDATE lessons SET regular_done = 1 WHERE id = ?");
  let filled = 0;
  d.transaction(() => {
    for (const l of lessons) {
      const member = byWeek.get(weekOfMonth(l.date));
      if (!member) continue;
      if (declined.get(l.id, member)) skip.run(l.id);
      else filled += set.run(member, l.id).changes;
    }
  })();
  return filled;
}

/**
 * Saves who teaches each Sunday of the month (null: no one). Upcoming lessons the old
 * regular teacher was put on automatically move to the new one (or open up). Returns
 * who was added and who was taken off, with their Sundays, to tell them.
 */
export function saveRegularTeachers(orgId: number, byWeek: (number | null)[], today: string) {
  const d = db();
  const before = new Map(regularTeachers(orgId).map((r) => [r.week, r.member_id]));
  const changedWeeks: number[] = [];
  d.transaction(() => {
    WEEKS.forEach((week, i) => {
      const next = byWeek[i] ?? null;
      const prev = before.get(week) ?? null;
      if (next === prev) return;
      changedWeeks.push(week);
      if (next) d.prepare("INSERT INTO regular_teachers (org_id, week, member_id) VALUES (?, ?, ?) ON CONFLICT (org_id, week) DO UPDATE SET member_id = excluded.member_id").run(orgId, week, next);
      else d.prepare("DELETE FROM regular_teachers WHERE org_id = ? AND week = ?").run(orgId, week);
      // That Sunday's upcoming lessons filled automatically go to the new teacher.
      const auto = d.prepare("SELECT id, date, teacher_id FROM lessons WHERE org_id = ? AND date >= ? AND teacher_auto = 1 AND teacher_id IS NOT NULL").all(orgId, today) as {
        id: number;
        date: string;
        teacher_id: number;
      }[];
      for (const l of auto.filter((l) => weekOfMonth(l.date) === week)) {
        removeTeacherNotes(l.id, l.teacher_id);
        d.prepare("UPDATE lessons SET teacher_id = NULL, teacher_confirmed_at = NULL, teacher_auto = 0, regular_done = 0 WHERE id = ?").run(l.id);
      }
      // (Lessons left open because that Sunday had no regular teacher were never marked
      // filled, so they're filled below; ones a leader cleared by hand stay open.)
    });
  })();
  const filled = fillRegularTeachers(orgId, today);
  const weeksOf = (m: Map<number, number>, id: number) => [...m].filter(([w, who]) => who === id && changedWeeks.includes(w)).map(([w]) => w);
  const after = new Map(regularTeachers(orgId).map((r) => [r.week, r.member_id]));
  const added = [...new Set(after.values())].map((id) => ({ id, weeks: weeksOf(after, id), all: [...after].filter(([, who]) => who === id).map(([w]) => w) })).filter((t) => t.weeks.length);
  const removed = [...new Set(before.values())].map((id) => ({ id, weeks: weeksOf(before, id).filter((w) => after.get(w) !== id) })).filter((t) => t.weeks.length);
  return { added, removed, filled, changed: changedWeeks.length };
}

/** Tells the teachers added or taken off by saveRegularTeachers. */
export async function tellRegularTeachers(orgId: number, orgLabel: string, changes: { added: { id: number; all: number[] }[]; removed: { id: number; weeks: number[] }[] }, url = "/admin/lessons") {
  for (const t of changes.added) {
    const who = recipientById(t.id, orgId);
    if (!who) continue;
    await notify([who], {
      title: `You're a regular teacher in ${orgLabel}`,
      body: `Thank you! You're teaching on the ${weeksText(t.all)} of each month. Your lessons show under My assignments, and you'll get a reminder the week before each one.`,
      url: "/assignments",
    }, { followUp: { what: `Made a regular teacher (${weeksText(t.all)} of each month)`, url } });
  }
  for (const t of changes.removed) {
    const who = recipientById(t.id, orgId);
    if (who) await notify([who], { title: `${orgLabel} teaching schedule`, body: `You're no longer the regular teacher on the ${weeksText(t.weeks)}. Thank you for teaching!`, url: "/assignments" });
  }
}

/**
 * Someone who left the organization (or was taken out) stops being a regular teacher:
 * their Sundays open up and the upcoming lessons they were put on automatically open
 * for the next regular teacher. Returns the changes (no one is notified).
 */
export function dropRegularTeacher(orgId: number, memberId: number, today: string = new Date().toISOString().slice(0, 10)) {
  const byWeek = WEEKS.map((w) => {
    const who = regularTeachers(orgId).find((r) => r.week === w)?.member_id ?? null;
    return who === memberId ? null : who;
  });
  return saveRegularTeachers(orgId, byWeek, today);
}
