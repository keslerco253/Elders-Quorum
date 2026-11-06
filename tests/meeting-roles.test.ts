import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { createMeeting, deleteMeetingRecord, finishMeeting, getMeeting } from "@/lib/meetings";
import { assignMeetingRole, closeRoleTodos, roleTodoId, syncRoleTodosWhen } from "@/lib/meeting-roles";
import { assignmentReview, getTodo, myAssignments, orgTodos } from "@/lib/assignments";
import { answerHandoff, askToTake, pendingHandoff, unableToDo } from "@/lib/assignment-handoffs";

describe("prayers and the spiritual thought as assignments", () => {
  let m: number;
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'F', 'First', 'f@x.com', 'presidency'), (3, 1, 'S', 'Second', 's@x.com', 'presidency');
    `);
    m = createMeeting(1, "2026-11-12", "", 1, { time: "19:00", tz: "America/Boise" });
  });

  it("puts it on the person's assignments, and moves it when someone else is chosen", () => {
    const r = assignMeetingRole(1, m, "opening_prayer", 2, 1);
    expect(r).toMatchObject({ previous: null, changed: true });
    const t = getTodo(r.todoId!)!;
    expect(t).toMatchObject({ title: "Opening prayer: Presidency meeting", assignee_id: 2, due_date: "2026-11-12", due_time: "19:00", meeting_role: "opening_prayer", accept_status: "accepted" });
    expect(getMeeting(1, m)!.opening_prayer).toBe("First");
    expect(myAssignments(2, "2026-11-10").some((i) => i.title === "Opening prayer: Presidency meeting")).toBe(true);
    // Not with the meeting's own assignments or the assignment review.
    expect(orgTodos(1, { meetingId: m })).toEqual([]);
    expect(assignmentReview(1).open).toEqual([]);
    // Choosing someone else: the same assignment, now theirs.
    expect(assignMeetingRole(1, m, "opening_prayer", 3, 1)).toMatchObject({ previous: 2, todoId: r.todoId, changed: true });
    expect(getTodo(r.todoId!)!.assignee_id).toBe(3);
    expect(assignMeetingRole(1, m, "opening_prayer", 3, 1).changed).toBe(false);
    // No one: it's taken off.
    expect(assignMeetingRole(1, m, "opening_prayer", null, 1)).toMatchObject({ previous: 3, changed: true });
    expect(roleTodoId(m, "opening_prayer")).toBeUndefined();
    expect(getMeeting(1, m)!.opening_prayer).toBe("");
  });

  it("follows a hand-off, or going back to the presidency, and the meeting's time", () => {
    const id = assignMeetingRole(1, m, "spiritual_thought", 2, 1).todoId!;
    askToTake(id, 2, 3, "I'll be out of town");
    answerHandoff(pendingHandoff(id)!.id, 3, true);
    expect(getMeeting(1, m)!.spiritual_thought).toBe("Second");
    unableToDo(id, 3, "Sick");
    expect(getMeeting(1, m)!.spiritual_thought).toBe("");
    db().prepare("UPDATE meetings SET date = '2026-11-19', time = '18:30' WHERE id = ?").run(m);
    syncRoleTodosWhen(1, m);
    expect(getTodo(id)).toMatchObject({ due_date: "2026-11-19", due_time: "18:30" });
  });

  it("is done when the meeting is finished or past, and goes with a deleted meeting", () => {
    const id = assignMeetingRole(1, m, "closing_prayer", 2, 1).todoId!;
    finishMeeting(1, m, "2026-11-12");
    expect(getTodo(id)!.done).toBe(1);
    const m2 = createMeeting(1, "2026-11-26", "", 1, { time: "19:00", tz: "America/Boise" });
    const id2 = assignMeetingRole(1, m2, "closing_prayer", 2, 1).todoId!;
    closeRoleTodos(null, "2026-11-27");
    expect(getTodo(id2)!.done).toBe(0);
    closeRoleTodos(null, "2026-11-28");
    expect(getTodo(id2)!.done).toBe(1);
    const m3 = createMeeting(1, "2026-12-03", "", 1, { time: "19:00", tz: "America/Boise" });
    const id3 = assignMeetingRole(1, m3, "opening_prayer", 2, 1).todoId!;
    deleteMeetingRecord(1, m3);
    expect(getTodo(id3)).toBeUndefined();
  });
});
