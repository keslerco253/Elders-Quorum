import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-scheduled-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

const TZ = "America/Boise";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toUTC();
const iso = (s: string) => at(s).toISO({ suppressMilliseconds: true })!;

describe("scheduled messages and one-time reminder wording", () => {
  it("sends a scheduled message at its time, then its reminder, once each; can be changed or canceled", async () => {
    const { useTestDb } = await import("@/lib/db");
    const d = useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'),
        (2, 1, 'A', 'Amy', 'a@x.com', 'member');
    `);
    const s = await import("@/lib/scheduled-messages");
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    const id = s.scheduleMessage({ org_id: org, sender_id: 1, audience: "everyone", title: "Service project", body: "Saturday at 9, bring gloves.", link: "/", flyer_file: null, flyer_name: null, send_at: iso("2026-12-01T09:00"), reminder_at: iso("2026-12-04T18:00") });
    expect(s.pendingScheduled(1)).toHaveLength(1);
    // Nothing before its time.
    expect(await s.sendDueScheduled(at("2026-12-01T08:59"))).toBe(0);
    // Changed before it goes.
    expect(s.updateScheduled(id, 1, { title: "Service project", body: "Saturday at 10 now, bring gloves.", send_at: iso("2026-12-01T09:00"), reminder_at: iso("2026-12-04T18:00") })).toBe(true);
    expect(await s.sendDueScheduled(at("2026-12-01T09:01"))).toBe(1);
    expect(await s.sendDueScheduled(at("2026-12-01T09:02"))).toBe(0);
    const titles = () => (d.prepare("SELECT title, body FROM messages ORDER BY id").all() as { title: string; body: string }[]);
    expect(titles()).toEqual([{ title: "Service project", body: "Saturday at 10 now, bring gloves." }]);
    // Still listed until its reminder goes.
    expect(s.pendingScheduled(1)[0].sent_at).not.toBeNull();
    expect(await s.sendDueScheduled(at("2026-12-04T18:00"))).toBe(1);
    expect(titles().map((t) => t.title)).toEqual(["Service project", "Reminder: Service project"]);
    expect(s.pendingScheduled(1)).toHaveLength(0);
    // Members can't change it; a canceled one never goes.
    const other = s.scheduleMessage({ org_id: org, sender_id: 1, audience: "everyone", title: "T", body: "B", link: "/", flyer_file: null, flyer_name: null, send_at: iso("2026-12-10T09:00"), reminder_at: null });
    expect(s.cancelScheduled(other, 2)).toBe(false);
    expect(s.cancelScheduled(other, 1)).toBe(true);
    expect(await s.sendDueScheduled(at("2026-12-11T09:00"))).toBe(0);
  });

  it("uses an event's own reminder wording, just for that event", async () => {
    const { db } = await import("@/lib/db");
    const { collectDue } = await import("@/lib/scheduler");
    const d = db();
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    const add = (title: string, text: string | null) =>
      Number(d.prepare("INSERT INTO events (org_id, title, starts_at, ends_at, reminder_minutes, reminder_text, created_by) VALUES (?, ?, ?, ?, 60, ?, 1)").run(org, title, iso("2026-12-12T18:00"), iso("2026-12-12T20:00"), text).lastInsertRowid);
    const changed = add("Christmas party", "The party starts at 6:30 now, not 6, and it's in the gym.");
    const usual = add("Choir practice", null);
    const due = collectDue(at("2026-12-12T17:01"));
    const one = due.find((n) => n.key === `event:${changed}:${iso("2026-12-12T18:00")}`)!;
    expect(one.payload).toMatchObject({ body: "The party starts at 6:30 now, not 6, and it's in the gym.", textFull: "The party starts at 6:30 now, not 6, and it's in the gym." });
    const two = due.find((n) => n.key === `event:${usual}:${iso("2026-12-12T18:00")}`)!;
    expect(two.payload.body).not.toMatch(/6:30/);
    expect(two.payload.textFull).toBeUndefined();
  });
});
