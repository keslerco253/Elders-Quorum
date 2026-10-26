import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { myAssignments } from "@/lib/assignments";
import { canTextTodos, getPersonalTodo, savePersonalTodo, setPersonalTodoDone, todoReminders } from "@/lib/personal-todos";

const R = (when: string, ways: { push?: boolean; text?: boolean; email?: boolean } = {}) => ({ when, push: !!ways.push, text: !!ways.text, email: !!ways.email });
const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("members' own private to-dos", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'S', 'Sam', 's@x.com', 'member');
    `);
  });

  const base = { title: "Take dinner to the Larsens", notes: "", due_date: "2026-11-05", due_time: null };

  it("are private; any number of reminders, texts only for presidency members (up to 3)", () => {
    expect(canTextTodos(2)).toBe(false);
    expect(canTextTodos(1)).toBe(true);
    const many = ["m:15", "m:30", "m:60", "m:120", "m:1440"].map((when) => R(when, { text: true }));
    const mine = savePersonalTodo(2, null, { ...base, reminders: many })!;
    // A member: all of them, none by text (so by app notification).
    expect(todoReminders(getPersonalTodo(2, mine)!)).toEqual(["m:1440", "m:120", "m:60", "m:30", "m:15"].map((w) => R(w, { push: true })));
    expect(getPersonalTodo(1, mine)).toBeUndefined();
    // A presidency member: the first 3 ticked are texts, the rest app notifications.
    const pres = savePersonalTodo(1, null, { ...base, reminders: [...many, R("m:15", { text: true }), R("bogus")] })!;
    expect(todoReminders(getPersonalTodo(1, pres)!).map((r) => r.text)).toEqual([false, false, true, true, true]);
    expect(myAssignments(2, "2026-10-22").map((i) => [i.kind, i.title])).toEqual([["mine", "Take dinner to the Larsens"]]);
    // Not in a presidency's view of the member.
    const orgId = (db().prepare("SELECT org_id FROM org_members WHERE member_id = 2 LIMIT 1").get() as { org_id: number }).org_id;
    expect(myAssignments(2, "2026-10-22", { orgId }).filter((i) => i.kind === "mine")).toEqual([]);
    // Someone else can't change it.
    expect(savePersonalTodo(1, mine, { ...base, title: "Hijacked", reminders: [] })).toBeNull();
  });

  it("reminds before the due time (9 AM without one), by text or app notification, and not once it's done", () => {
    const id = savePersonalTodo(1, null, { ...base, title: "Call the Larsens", due_time: "19:00", reminders: [R("m:60", { text: true }), R("m:15", { push: true, email: true })] })!;
    const due = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("ptodo:"));
    expect(due("2026-11-05T17:59")).toEqual([]);
    const [n] = due("2026-11-05T18:00");
    expect(n).toMatchObject({ only: ["text"], recipients: [{ id: 1 }], payload: { title: "Your to-do is due in 1 hour", body: "Call the Larsens (due Thu, Nov 5 at 7:00 PM)", url: `/assignments/mine/${id}` } });
    expect(due("2026-11-05T18:45").find((x) => x.key.endsWith(":m:15"))).toMatchObject({ only: ["push", "email"], payload: { title: "Your to-do is due in 15 minutes" } });
    // No time: counted from 9 AM.
    const noTime = savePersonalTodo(2, null, { ...base, reminders: [R("m:1440")] })!;
    expect(due("2026-11-04T09:00").map((x) => x.payload.url)).toEqual([`/assignments/mine/${noTime}`]);
    setPersonalTodoDone(1, id, true);
    expect(due("2026-11-05T18:00")).toEqual([]);
  });

  it("keeps reminders saved before the ways could be chosen, and email only with an email", () => {
    const id = savePersonalTodo(2, null, { ...base, reminders: [] })!;
    db().prepare("UPDATE personal_todos SET reminders = ? WHERE id = ?").run(JSON.stringify([{ when: "m:60", text: 1 }, { when: "m:15", text: 0 }]), id);
    expect(todoReminders(getPersonalTodo(2, id)!)).toEqual([R("m:60", { text: true }), R("m:15", { push: true })]);
    db().prepare("UPDATE members SET email = NULL, phone = '+12085550100' WHERE id = 2").run();
    savePersonalTodo(2, id, { ...base, reminders: [R("m:60", { email: true })] });
    expect(todoReminders(getPersonalTodo(2, id)!)).toEqual([R("m:60", { push: true })]);
  });
});
