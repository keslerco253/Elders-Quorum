import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-quiet-"));
process.env.SMS_DEV_OUTBOX = "1";

const boise = (local: string) => DateTime.fromISO(local, { zone: "America/Boise" }).toUTC();

describe("quiet hours for texts", () => {
  beforeEach(() => {
    process.env.QUIET_HOURS = "on";
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', '+12085550001', 'presidency'),
        (2, 1, 'T', 'Tex', NULL, '+12085550002', 'member');
    `);
    db().prepare("UPDATE members SET sms_consent_at = datetime('now'), always_text = 1, contact_pref = 'text' WHERE id = 2").run();
    db().prepare("UPDATE wards SET texting_enabled = 1").run();
  });
  afterEach(() => {
    process.env.QUIET_HOURS = "off";
    vi.useRealTimers();
  });

  it("holds texts from 9 PM until the morning hour, in the ward's time zone", async () => {
    const { quietUntil } = await import("@/lib/quiet-hours");
    const org = (db().prepare("SELECT id FROM orgs WHERE kind <> 'ward' LIMIT 1").get() as { id: number }).id;
    expect(quietUntil(org, boise("2026-11-08T20:59"))).toBeNull();
    expect(quietUntil(org, boise("2026-11-08T23:00"))).toBe(boise("2026-11-09T08:00").toISO());
    expect(quietUntil(org, boise("2026-11-09T05:30"))).toBe(boise("2026-11-09T08:00").toISO());
    expect(quietUntil(org, boise("2026-11-09T08:00"))).toBeNull();
  });

  it("a leader's message at 11 PM: the app notification now, the text at 8 AM; a scheduled reminder isn't held", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(boise("2026-11-08T23:00").toJSDate());
    const { notify, recipientById, sendHeldTexts } = await import("@/lib/notify");
    const org = (db().prepare("SELECT id FROM orgs WHERE kind <> 'ward' LIMIT 1").get() as { id: number }).id;
    const tex = recipientById(2, org)!;
    const res = await notify([tex], { title: "You're teaching", body: "Thanks for teaching Sunday.", url: "/lessons/1" });
    expect(res).toMatchObject({ text: 1, held: 1 });
    expect((db().prepare("SELECT COUNT(*) AS n FROM sms_log").get() as { n: number }).n).toBe(0);
    // Not before 8 AM.
    expect(await sendHeldTexts(boise("2026-11-09T07:59").toJSDate())).toBe(0);
    expect(await sendHeldTexts(boise("2026-11-09T08:00").toJSDate())).toBe(1);
    expect((db().prepare("SELECT COUNT(*) AS n FROM held_texts").get() as { n: number }).n).toBe(0);
    expect((db().prepare("SELECT last_text_org_id FROM members WHERE id = 2").get() as { last_text_org_id: number }).last_text_org_id).toBe(org);
    // A reminder at the time chosen for it goes now.
    expect(await notify([tex], { title: "Reminder", body: "b", url: "/" }, { scheduled: true })).toMatchObject({ text: 1 });
    // Replied STOP overnight: the held text isn't sent.
    await notify([tex], { title: "Late", body: "b", url: "/" });
    db().prepare("UPDATE members SET sms_consent_at = NULL WHERE id = 2").run();
    expect(await sendHeldTexts(boise("2026-11-09T08:00").toJSDate())).toBe(0);
  });
});
