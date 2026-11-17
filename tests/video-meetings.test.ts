import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-video-meetings-"));

const TZ = "America/Boise";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toUTC();

describe("meetings held over Zoom", () => {
  it("joins with the saved or the meeting's own link, around its time, for those in it; reminds and says it's starting", async () => {
    const { useTestDb } = await import("@/lib/db");
    const d = useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'),
        (2, 1, 'C', 'Couns', 'c@x.com', 'presidency'),
        (3, 1, 'A', 'Amy', 'a@x.com', 'member'),
        (4, 1, 'B', 'Bob', 'b@x.com', 'member');
    `);
    const m = await import("@/lib/meetings");
    const { collectDue } = await import("@/lib/scheduler");
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    const SAVED = "https://us02web.zoom.us/j/111?pwd=a";
    m.setVideoLink(org, SAVED);

    // A presidency meeting over Zoom, with the saved link.
    const id = m.createMeeting(org, "2026-12-01", "", 1, { time: "19:00", tz: TZ, video: { on: true, link: null } });
    const pm = m.meetingById(id)!;
    expect(m.meetingVideoLink(pm)).toBe(SAVED);
    const event = d.prepare("SELECT location, description FROM events WHERE id = ?").get(pm.event_id) as { location: string; description: string };
    expect(event.location).toBe("Zoom");
    expect(event.description).toMatch(/Join meeting/);
    // Open from an hour before to 3 hours after, for the presidency only.
    expect(m.meetingVideoLinkFor(pm, 2, TZ, at("2026-12-01T17:30"))).toBeNull();
    expect(m.meetingVideoLinkFor(pm, 2, TZ, at("2026-12-01T18:05"))).toBe(SAVED);
    expect(m.meetingVideoLinkFor(pm, 3, TZ, at("2026-12-01T19:00"))).toBeNull();
    expect(m.meetingVideoLinkFor(pm, 2, TZ, at("2026-12-01T22:30"))).toBeNull();

    // Its reminder carries the Join button.
    d.prepare("UPDATE events SET reminder_minutes = 60, reminder2_minutes = NULL WHERE id = ?").run(pm.event_id);
    const reminder = collectDue(at("2026-12-01T18:00")).find((n) => n.key.includes(`:${pm.event_id}:`));
    expect(reminder?.payload).toMatchObject({ url: `/join-meeting?meeting=${id}&org=${org}`, linkLabel: "Join" });

    // "Starting now", once, within 15 minutes of its time, to the presidency.
    const starts = (iso: string) => collectDue(at(iso)).filter((n) => n.key.startsWith("video-start:"));
    expect(starts("2026-12-01T18:55")).toHaveLength(0);
    const now = starts("2026-12-01T19:02");
    expect(now).toHaveLength(1);
    expect(now[0].recipients.map((r) => r.id).sort()).toEqual([1, 2]);
    expect(now[0].payload).toMatchObject({ title: expect.stringMatching(/is starting$/), linkLabel: "Join" });
    expect(starts("2026-12-01T19:20")).toHaveLength(0);

    // An invited meeting with its own link: those invited (not those who said no) can join.
    const OWN = "https://meet.google.com/abc-defg-hij";
    const inv = m.createMeeting(org, "2026-12-02", "Activities committee", 1, { time: "20:00", tz: TZ, kind: "invited", video: { on: true, link: OWN } });
    d.prepare("INSERT INTO meeting_invitees (meeting_id, member_id, response) VALUES (?, 3, 'yes'), (?, 4, 'no')").run(inv, inv);
    const im = m.meetingById(inv)!;
    expect(m.meetingVideoLinkFor(im, 3, TZ, at("2026-12-02T19:30"))).toBe(OWN);
    expect(m.meetingVideoLinkFor(im, 4, TZ, at("2026-12-02T19:30"))).toBeNull();
    const invStart = collectDue(at("2026-12-02T20:01")).filter((n) => n.key === `video-start:${inv}:2026-12-02T20:00`);
    expect(invStart[0].recipients.map((r) => r.id)).toEqual([3]);

    // Turned off: no link, no notice.
    d.prepare("UPDATE meetings SET video = 0 WHERE id = ?").run(id);
    expect(m.meetingVideoLink(m.meetingById(id)!)).toBeNull();
  });

  it("carries Zoom to each meeting of a repeating series", async () => {
    const { db } = await import("@/lib/db");
    const { createMeetingSeries } = await import("@/lib/meeting-series");
    const org = (db().prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    createMeetingSeries(org, { pattern: "weekly", start: "2027-01-03", until: null, count: null, time: "08:00", title: "", location: "", reminders: [null, null], video: { on: true, link: null } }, 1, TZ);
    const rows = db().prepare("SELECT video, video_link FROM meetings WHERE series_id IS NOT NULL").all();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => (r as { video: number }).video === 1)).toBe(true);
  });
});
