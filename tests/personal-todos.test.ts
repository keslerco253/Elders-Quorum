import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { myAssignments } from "@/lib/assignments";
import { getPersonalTodo, personalChannels, savePersonalTodo, setPersonalTodoDone } from "@/lib/personal-todos";

const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("members' own private to-dos", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'S', 'Sam', 's@x.com', 'member');
    `);
  });

  it("are private, and texts are only for presidency members", () => {
    expect(personalChannels(2)).toEqual(["push", "email"]);
    expect(personalChannels(1)).toEqual(["push", "email", "text"]);
    const t = { title: "Take dinner to the Larsens", notes: "", due_date: "2026-11-05", reminder1_days: 1, reminder2_days: null, channels: ["push", "email", "text"] };
    const mine = savePersonalTodo(2, null, t)!;
    expect(getPersonalTodo(2, mine)?.channels).toBe("push,email");
    expect(getPersonalTodo(1, mine)).toBeUndefined();
    expect(getPersonalTodo(1, savePersonalTodo(1, null, t)!)?.channels).toBe("push,email,text");
    expect(myAssignments(2, "2026-10-22").map((i) => [i.kind, i.title])).toEqual([["mine", "Take dinner to the Larsens"]]);
    // Not in a presidency's view of the member.
    const orgId = (db().prepare("SELECT org_id FROM org_members WHERE member_id = 2 LIMIT 1").get() as { org_id: number }).org_id;
    expect(myAssignments(2, "2026-10-22", { orgId }).filter((i) => i.kind === "mine")).toEqual([]);
    // Someone else can't change it.
    expect(savePersonalTodo(1, mine, { ...t, title: "Hijacked" })).toBeNull();
  });

  it("reminds the ways they chose, and not once it's done", () => {
    const id = savePersonalTodo(2, null, { title: "Home teaching report", notes: "", due_date: "2026-11-05", reminder1_days: 2, reminder2_days: null, channels: ["email"] })!;
    const due = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("ptodo:"));
    expect(due("2026-11-03T07:59")).toEqual([]);
    const [n] = due("2026-11-03T08:00");
    expect(n).toMatchObject({ only: ["email"], recipients: [{ id: 2 }], payload: { title: "Your to-do is due in 2 days", url: `/assignments/mine/${id}` } });
    setPersonalTodoDone(2, id, true);
    expect(due("2026-11-03T09:00")).toEqual([]);
  });
});
