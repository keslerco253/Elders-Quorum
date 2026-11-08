import { beforeEach, describe, expect, it } from "vitest";
import { db, useTestDb } from "@/lib/db";
import { getPersonalEvent, personalEventsBetween, savePersonalEvent, skipPersonalDate } from "@/lib/personal-events";
import { personalTodos, savePersonalTodo, setPersonalTodoDone } from "@/lib/personal-todos";
import { lastOfCount, nextOccurrence, patternOptions } from "@/lib/recurrence";

const base = { notes: "", location: "", start_time: "07:00", end_time: null, all_day: false, timezone: "America/Boise", reminders: [] };

describe("a member's own events and to-dos that repeat", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'member');
    `);
  });

  it("offers every day and every year only for one's own", () => {
    expect(patternOptions("2026-11-10").map((o) => o.value)).not.toContain("daily");
    expect(patternOptions("2026-11-10", true).map((o) => o.value)).toEqual(["daily", "weekly", "biweekly", "monthly_nth", "monthly_day", "yearly"]);
    expect(lastOfCount({ pattern: "weekly", start: "2026-11-10" }, 3)).toBe("2026-11-24");
    expect(nextOccurrence({ pattern: "yearly", start: "2026-11-10", until: null, count: null }, "2026-11-10")).toBe("2027-11-10");
  });

  it("shows each date of a repeating event, without skipped ones", () => {
    const id = savePersonalEvent(1, null, { ...base, title: "Gym", date: "2026-11-10", repeat: { pattern: "weekly", until: "2026-12-01" } })!;
    const dates = () => personalEventsBetween(1, "2026-11-01T00:00:00Z", "2026-12-31T00:00:00Z").map((e) => e.personal_date);
    expect(dates()).toEqual(["2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01"]);
    const ids = personalEventsBetween(1, "2026-11-01T00:00:00Z", "2026-12-31T00:00:00Z").map((e) => e.id);
    expect(new Set(ids).size).toBe(4);
    expect(skipPersonalDate(1, id, "2026-11-17")).toBe(true);
    expect(dates()).toEqual(["2026-11-10", "2026-11-24", "2026-12-01"]);
    // A long-running one is still found well after it started.
    savePersonalEvent(1, id, { ...base, title: "Gym", date: "2026-11-10", repeat: { pattern: "weekly", until: null } });
    expect(personalEventsBetween(1, "2027-06-01T00:00:00Z", "2027-06-08T00:00:00Z").map((e) => e.personal_date)).toEqual(["2027-06-01"]);
    expect(getPersonalEvent(1, id)!.repeat).toBe("weekly");
  });

  it("adds the next to-do when a repeating one is done, once", () => {
    const id = savePersonalTodo(1, null, { title: "Home teaching report", notes: "", due_date: "2026-11-30", due_time: null, reminders: [], repeat: { pattern: "monthly_day", until: null } })!;
    expect(setPersonalTodoDone(1, id, true)).toBe("2026-12-30");
    expect(personalTodos(1, false).map((t) => t.due_date)).toEqual(["2026-12-30"]);
    setPersonalTodoDone(1, id, false);
    expect(setPersonalTodoDone(1, id, true)).toBeNull();
    expect((db().prepare("SELECT COUNT(*) AS n FROM personal_todos").get() as { n: number }).n).toBe(2);
    // No due date: it can't repeat.
    const plain = savePersonalTodo(1, null, { title: "Call", notes: "", due_date: null, due_time: null, reminders: [], repeat: { pattern: "weekly", until: null } })!;
    expect(setPersonalTodoDone(1, plain, true)).toBeNull();
  });
});
