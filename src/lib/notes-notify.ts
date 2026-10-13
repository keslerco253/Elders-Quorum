import { audienceMembers, notify } from "./notify";
import { formatDate } from "./time";
import type { LessonListItem } from "./lessons";

/** Tells the quorum that notes for a lesson are ready to read. */
export async function announceNotes(wardId: number, lesson: LessonListItem, teacherName: string) {
  return notify(audienceMembers(wardId, "everyone"), {
    title: `Notes for ${formatDate(lesson.date, "short")}'s lesson`,
    body: `${teacherName} shared notes${lesson.title ? ` on "${lesson.title}"` : ""}. Tap to read them before Sunday.`,
    url: `/lessons/${lesson.id}#notes`,
  });
}
