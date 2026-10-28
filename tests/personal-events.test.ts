import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { useTestDb } from "@/lib/db";
import { collectDue } from "@/lib/scheduler";
import { todoReminders } from "@/lib/personal-todos";
import { icsFeed } from "@/lib/events";
import { eventHref, getPersonalEvent, personalEventsBetween, savePersonalEvent } from "@/lib/personal-events";

const R = (when: string, ways: { push?: boolean; text?: boolean; email?: boolean } = {}) => ({ when, push: !!ways.push, text: !!ways.text, email: !!ways.email });
const at = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("members' own calendar events", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'S', 'Sam', 's@x.com', 'member');
    `);
  });

  const base = { title: "Dentist", notes: "", location: "Main St", date: "2026-11-05", start_time: "15:00", end_time: null, all_day: false, timezone: "America/Boise" };

  it("are only theirs, show on their calendar, and last an hour without an end", () => {
    const id = savePersonalEvent(2, null, { ...base, reminders: [] })!;
    expect(getPersonalEvent(1, id)).toBeUndefined();
    expect(savePersonalEvent(1, id, { ...base, title: "Hijacked", reminders: [] })).toBeNull();
    const [e] = personalEventsBetween(2, "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z");
    expect(e).toMatchObject({ title: "Dentist", starts_at: "2026-11-05T22:00:00Z", ends_at: "2026-11-05T23:00:00Z", personal_event_id: id, org_label: "Only you" });
    expect(eventHref(e)).toBe(`/calendar/mine/${id}`);
    expect(personalEventsBetween(1, "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z")).toEqual([]);
  });

  it("reminds before it starts by the ways chosen; a member's texts become app notifications", () => {
    const id = savePersonalEvent(2, null, { ...base, reminders: [R("m:60", { text: true }), R("m:0", { push: true, email: true })] })!;
    expect(todoReminders(getPersonalEvent(2, id)!)).toEqual([R("m:60", { push: true }), R("m:0", { push: true, email: true })]);
    const due = (t: string) => collectDue(at(t)).filter((n) => n.key.startsWith("pevent:"));
    expect(due("2026-11-05T13:59")).toEqual([]);
    expect(due("2026-11-05T14:00")[0]).toMatchObject({ only: ["push"], payload: { title: "Dentist starts in 1 hour", url: `/calendar/mine/${id}` } });
    expect(due("2026-11-05T15:00").find((n) => n.key.endsWith(":m:0"))).toMatchObject({ only: ["push", "email"], payload: { title: "Starting now: Dentist" } });
    // A presidency member's text stays a text.
    savePersonalEvent(1, null, { ...base, title: "Interview", reminders: [R("m:60", { text: true })] });
    expect(due("2026-11-05T14:00").find((n) => n.recipients[0].id === 1)?.only).toEqual(["text"]);
  });

  it("are in their own subscribed calendar, as private events", () => {
    const id = savePersonalEvent(2, null, { ...base, reminders: [] })!;
    const ics = icsFeed(personalEventsBetween(2, "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z"), "W", "America/Boise", [], "example.org");
    expect(ics).toContain(`UID:personal-${id}@example.org`);
    expect(ics).toContain("SUMMARY:Dentist");
    expect(ics).toContain("CLASS:PRIVATE");
    expect(ics).toContain(`/calendar/mine/${id}`);
  });

  it("are in the subscribed calendar only if the member chose them", async () => {
    savePersonalEvent(2, null, { ...base, date: DateTime.utc().plus({ days: 3 }).toISODate()!, reminders: [] });
    const { feedPath } = await import("@/lib/events");
    const { GET } = await import("@/app/feed/[member]/[token]/route");
    const { db } = await import("@/lib/db");
    const feed = async () => {
      const m = db().prepare("SELECT id, feed_version FROM members WHERE id = 2").get() as { id: number; feed_version: number };
      const token = feedPath(m).split("/").pop()!;
      return (await GET(new Request("http://x"), { params: Promise.resolve({ member: "2", token }) })).text();
    };
    // Not until they choose (a link made before may have been shared).
    expect(await feed()).not.toContain("SUMMARY:Dentist");
    db().prepare("UPDATE members SET feed_contents = 'both', feed_contents_set_at = datetime('now') WHERE id = 2").run();
    expect(await feed()).toContain("SUMMARY:Dentist");
    db().prepare("UPDATE members SET feed_contents = 'ward' WHERE id = 2").run();
    expect(await feed()).not.toContain("SUMMARY:Dentist");
    db().prepare("UPDATE members SET feed_contents = 'personal' WHERE id = 2").run();
    const only = await feed();
    expect(only).toContain("SUMMARY:Dentist");
    expect(only).toContain("X-WR-CALNAME:My events");
  });
});
