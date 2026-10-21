import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { myAssignments, setTodoStatus, soonAssignments, todoNotes } from "@/lib/assignments";
import { addAgendaItem, createMeeting, finishMeeting, pendingAgenda, meetingAgenda, recordsToReview, reviewRecord } from "@/lib/meetings";

const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("presidency planning and My assignments", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role, last_login_at) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency', '2026-10-01'),
        (2, 1, 'S', 'Sam', 's@x.com', 'member', '2026-10-01');
      INSERT INTO lessons (id, ward_id, date, kind, title, speaker, teacher_id) VALUES (10, 1, '2026-10-25', 'talk', 'Abide in My Love', 'Elder C', 2), (11, 1, '2026-10-11', 'talk', 'Old one', '', 2);
      INSERT INTO signups (id, ward_id, title, date) VALUES (20, 1, 'Smith move', '2026-11-01');
      INSERT INTO signup_slots (id, signup_id, label, capacity) VALUES (21, 20, 'Trailer', 1);
      INSERT INTO signup_entries (slot_id, member_id) VALUES (21, 2);
      INSERT INTO todos (id, ward_id, title, assignee_id, due_date, created_by) VALUES (30, 1, 'Visit the Larsens', 2, '2026-10-20', 1), (31, 1, 'Plan the social', 2, '2026-12-01', 1);
    `);
  });

  it("puts assignments, teaching and service together, soonest first", () => {
    const items = myAssignments(2, "2026-10-21");
    expect(items.map((i) => i.key)).toEqual(["todo:30", "teach:10", "serve:20", "todo:31"]);
    expect(items[0].flag).toEqual({ tone: "danger", text: "Overdue" });
    expect(items[1]).toMatchObject({ title: "Teach: Abide in My Love", flag: { text: "Please confirm" } });
    expect(items[2].detail).toContain("Trailer");
    // Home shows what's overdue, needs an answer, or is in the next two weeks.
    expect(soonAssignments(2, "2026-10-21").map((i) => i.key)).toEqual(["todo:30", "teach:10", "serve:20"]);
    // Past: the lesson already taught.
    expect(myAssignments(2, "2026-10-21", { past: true }).map((i) => i.key)).toEqual(["teach:11"]);
    setTodoStatus(30, "done", "2026-10-21");
    expect(myAssignments(2, "2026-10-21").map((i) => i.key)).not.toContain("todo:30");
    expect(myAssignments(2, "2026-10-21", { past: true }).map((i) => i.key)).toContain("todo:30");
  });

  it("keeps presidency-only progress notes from the person assigned", () => {
    db().prepare("INSERT INTO todo_notes (todo_id, author_id, body, private) VALUES (30, 2, 'Called them', 0), (30, 1, 'Family is struggling', 1)").run();
    expect(todoNotes(30, true)).toHaveLength(2);
    expect(todoNotes(30, false).map((n) => n.body)).toEqual(["Called them"]);
  });

  it("collects agenda items until a meeting where they're discussed is finished", () => {
    const a = addAgendaItem(1, "The Jones family: Brother Jones lost his job", { source: "Message from Pres to the presidency", addedBy: 1 });
    addAgendaItem(1, "Ward social", { addedBy: 1 });
    const m = createMeeting(1, "2026-10-21", "", 1);
    db().prepare("UPDATE agenda_items SET discussed = 1 WHERE id = ?").run(a);
    finishMeeting(1, m, "2026-10-21");
    expect(meetingAgenda(m).map((i) => i.id)).toEqual([a]);
    expect(pendingAgenda(1).map((i) => i.body)).toEqual(["Ward social"]);
    // The notes come up for review in 3 months; nothing is deleted on its own.
    expect(recordsToReview(1, "2027-01-20")).toHaveLength(0);
    // So does an agenda item that has waited 3 months.
    const review = recordsToReview(1, "2027-01-21");
    expect(review.map((r) => r.kind)).toEqual(["meeting", "agenda"]);
    reviewRecord(1, "agenda", review[1].id, false, "2027-01-21");
    reviewRecord(1, "meeting", m, true, "2027-01-21");
    expect(recordsToReview(1, "2027-01-21")).toHaveLength(0);
    expect(recordsToReview(1, "2027-04-21")).toHaveLength(1);
    reviewRecord(1, "meeting", m, false, "2027-04-21");
    expect(meetingAgenda(m)).toHaveLength(0);
  });

  it("reminds the presidency monthly about records to review, and links reminders to the assignment", () => {
    const m = createMeeting(1, "2026-06-01", "", 1);
    finishMeeting(1, m, "2026-06-01");
    const due = collectDue(at("2026-11-01T09:00")).filter((n) => n.key.startsWith("records-review"));
    expect(due).toHaveLength(1);
    expect(due[0].recipients.map((r) => r.id)).toEqual([1]);
    expect(collectDue(at("2026-11-02T09:00")).filter((n) => n.key.startsWith("records-review"))).toHaveLength(0);
    const rem = collectDue(at("2026-11-30T09:00")).find((n) => n.key.startsWith("todo-due:31"));
    expect(rem).toBeUndefined();
    const tomorrow = collectDue(at("2026-11-30T09:00")).find((n) => n.key.startsWith("todo-pre:31"));
    expect(tomorrow?.payload.url).toBe("/assignments/31?org=1");
  });
});
