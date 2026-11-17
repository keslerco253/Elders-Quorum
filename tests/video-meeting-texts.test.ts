import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-video-texts-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

const TZ = "America/Boise";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toUTC();
const texts = () => (fs.existsSync(path.join(dir, "outbox")) ? fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms")) : []).map((f) => fs.readFileSync(path.join(dir, "outbox", f), "utf8"));

// A Zoom meeting's reminders and "starting now" go out like any event's: by text to
// those who get texts, with a link that joins.
describe("texts for meetings over Zoom", () => {
  it("texts the reminder and the starting-now notice, with the Join link", async () => {
    const { useTestDb } = await import("@/lib/db");
    const d = useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', NULL, 'email', 'presidency'),
        (2, 1, 'C', 'Couns', NULL, '+12085550111', 'text', 'presidency');
    `);
    d.exec("UPDATE wards SET texting_enabled = 1; UPDATE members SET sms_consent_at = datetime('now') WHERE id = 2");
    const m = await import("@/lib/meetings");
    const { tick } = await import("@/lib/scheduler");
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    m.setVideoLink(org, "https://us02web.zoom.us/j/111?pwd=a");
    const id = m.createMeeting(org, "2026-12-01", "", 1, { time: "19:00", tz: TZ, video: { on: true, link: null }, reminders: [60, null] });
    await tick(at("2026-12-01T18:01"));
    const reminder = texts();
    expect(reminder).toHaveLength(1);
    expect(reminder[0]).toMatch(/Reminder: Presidency meeting, Tue, Dec 1 - 7:00 PM on Zoom\. Join: \S+\/n\/\d+/);
    expect(reminder[0]).toMatch(/\/n\/\d+/);
    await tick(at("2026-12-01T19:01"));
    const all = texts();
    expect(all).toHaveLength(2);
    expect(all.some((t) => /is starting now on Zoom/.test(t))).toBe(true);
    // The texted link opens the Join page for that meeting.
    const n = Number(all.find((t) => /starting now/.test(t))!.match(/\/n\/(\d+)/)![1]);
    expect((d.prepare("SELECT url FROM notification_log WHERE id = ?").get(n) as { url: string }).url).toContain(`/join-meeting?meeting=${id}`);
  });
});
