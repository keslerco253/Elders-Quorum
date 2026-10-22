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
