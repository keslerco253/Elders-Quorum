import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { getTodo, todoNotes } from "@/lib/assignments";
import { answerHandoff, askToTake, cancelHandoff, handoffsWaitingOn, pendingHandoff, unableToDo } from "@/lib/assignment-handoffs";

describe("handing off assignments", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'F', 'First', 'f@x.com', 'presidency'),
        (3, 1, 'S', 'Second', 's@x.com', 'presidency'), (4, 1, 'M', 'Sam', 'm@x.com', 'member');
      INSERT INTO todos (id, ward_id, title, assignee_id, created_by) VALUES (30, 1, 'Visit the Larsens', 1, 1);
    `);
  });

  it("asks one person, who takes it", () => {
    const r = askToTake(30, 1, 4, "Can you cover this?");
    expect("id" in r).toBe(true);
    expect(handoffsWaitingOn(4).map((a) => a.title)).toEqual(["Visit the Larsens"]);
    expect(handoffsWaitingOn(2)).toEqual([]);
    expect(answerHandoff(pendingHandoff(30)!.id, 2, true)).toBeNull(); // not theirs to answer
    const done = answerHandoff(pendingHandoff(30)!.id, 4, true)!;
    expect(done.previousAssignee).toBe(1);
    expect(getTodo(30)!.assignee_id).toBe(4);
    expect(pendingHandoff(30)).toBeUndefined();
  });

  it("asks the whole presidency: anyone but the asker can take it, and it's declined when all say no", () => {
    db().prepare("UPDATE todos SET assignee_id = 4 WHERE id = 30").run();
    askToTake(30, 1, null, "");
    const h = pendingHandoff(30)!;
    expect(handoffsWaitingOn(1)).toEqual([]);
    expect(handoffsWaitingOn(4)).toEqual([]); // a member, and has it
    expect(handoffsWaitingOn(2).length).toBe(1);
    expect(answerHandoff(h.id, 2, false)!.allDeclined).toBe(false);
    expect(handoffsWaitingOn(2)).toEqual([]);
    expect(answerHandoff(h.id, 3, false)!.allDeclined).toBe(true);
    expect(pendingHandoff(30)).toBeUndefined();
    expect(getTodo(30)!.assignee_id).toBe(4);
  });

  it("first to say yes takes it; asks can be withdrawn; members can't ask", () => {
    askToTake(30, 1, null, "");
    const h = pendingHandoff(30)!;
    answerHandoff(h.id, 3, true);
    expect(getTodo(30)!.assignee_id).toBe(3);
    expect(answerHandoff(h.id, 2, true)).toBeNull();
    expect(askToTake(30, 4, 2, "")).toEqual({ error: "Only the presidency can hand off an assignment." });
    expect(askToTake(30, 1, 3, "")).toEqual({ error: "That's who has it now. Choose someone else." });
    askToTake(30, 1, 2, "");
    expect(cancelHandoff(pendingHandoff(30)!.id, 2)).toBe(false);
    expect(cancelHandoff(pendingHandoff(30)!.id, 1)).toBe(true);
    expect(pendingHandoff(30)).toBeUndefined();
  });

  it("unable to do it: unassigns it and leaves the note", () => {
    db().prepare("UPDATE todos SET assignee_id = 4, status = 'progress' WHERE id = 30").run();
    expect(unableToDo(30, 2, "")).toBeNull();
    expect(unableToDo(30, 4, "Moving out of state")!.title).toBe("Visit the Larsens");
    const t = getTodo(30)!;
    expect([t.assignee_id, t.status]).toEqual([null, "open"]);
    expect(todoNotes(30, false).map((n) => n.body)).toEqual(["Unable to do this assignment: Moving out of state"]);
  });
});

describe("unassigned assignments wait on the presidency", () => {
  it("counts open ones no one has", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (4, 1, 'M', 'Sam', 'm@x.com', 'member');
      INSERT INTO todos (id, ward_id, title, assignee_id, done) VALUES (30, 1, 'Has someone', 4, 0), (31, 1, 'No one', NULL, 0), (32, 1, 'Finished', NULL, 1);
    `);
    const { createSession, userForSession } = await import("@/lib/auth-core");
    const { adminCounts } = await import("@/lib/admin-counts");
    const count = (id: number) => adminCounts(userForSession(createSession(id, "month").id)!);
    expect(count(1).unassigned).toBe(1);
    unableToDo(30, 4, "");
    expect(count(1).unassigned).toBe(2);
    expect(count(1).total).toBeGreaterThanOrEqual(2);
    expect(count(4).unassigned).toBe(0);
  });
});

describe("assignment requests", () => {
  it("waits for the person to accept: no reminders until then, and the presidency sees it", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (4, 1, 'M', 'Sam', 'm@x.com', 'member');
      INSERT INTO todos (id, ward_id, title, assignee_id, created_by, due_date) VALUES (30, 1, 'Bring the bread', 4, 1, '2026-11-05');
    `);
    db().prepare("UPDATE todos SET due_time = '19:00', accept_status = 'pending', reminder1_days = 1 WHERE id = 30").run();
    const { assignmentRequestsFor, acceptAssignment, dueText } = await import("@/lib/assignments");
    const { collectDue } = await import("@/lib/scheduler");
    const { createSession, userForSession } = await import("@/lib/auth-core");
    const { adminCounts } = await import("@/lib/admin-counts");
    const { DateTime } = await import("luxon");
    const count = () => adminCounts(userForSession(createSession(1, "month").id)!).notAccepted;
    const reminders = () => collectDue(DateTime.fromISO("2026-11-04T10:00", { zone: "America/Boise" }).toUTC()).filter((n) => n.key.startsWith("todo"));
    expect(assignmentRequestsFor(4).map((t) => t.title)).toEqual(["Bring the bread"]);
    expect(count()).toBe(1);
    expect(reminders()).toEqual([]);
    expect(dueText("2026-11-05", "19:00")).toBe("Thu, Nov 5 at 7:00 PM");
    expect(acceptAssignment(30, 1)).toBe(false); // only the person asked
    expect(acceptAssignment(30, 4)).toBe(true);
    expect(assignmentRequestsFor(4)).toEqual([]);
    expect(count()).toBe(0);
    expect(reminders().map((n) => n.key)).toEqual(["todo-pre:30:2026-11-05"]);
  });

  it("saying no sends it back unassigned with the note", () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (4, 1, 'M', 'Sam', 'm@x.com', 'member');
      INSERT INTO todos (id, ward_id, title, assignee_id, created_by) VALUES (30, 1, 'Bring the bread', 4, 1);
    `);
    db().prepare("UPDATE todos SET accept_status = 'pending' WHERE id = 30").run();
    unableToDo(30, 4, "Out of town", "Not able to accept this assignment");
    expect([getTodo(30)!.assignee_id, getTodo(30)!.accept_status]).toEqual([null, "accepted"]);
    expect(todoNotes(30, false)[0].body).toBe("Not able to accept this assignment: Out of town");
  });
});

describe("the leader guide", () => {
  it("can be searched", async () => {
    const { searchGuide } = await import("@/lib/guide");
    const hits = searchGuide("not accepted yet");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((h) => h.section)).toContain("Assignments");
    expect(searchGuide("zzzz nothing like this")).toEqual([]);
  });
});
