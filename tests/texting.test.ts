import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// Texts and emails go to a temporary outbox instead of Twilio/Gmail.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-texting-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("texting", () => {
  let notify: typeof import("@/lib/notify").notify;
  let recipientById: typeof import("@/lib/notify").recipientById;
  let textsThisMonth: typeof import("@/lib/sms").textsThisMonth;

  beforeAll(async () => {
    const dbm = await import("@/lib/db");
    const d = dbm.useTestDb(`
      INSERT INTO wards (id, name, sms_monthly_limit) VALUES (1, 'Test Ward EQ', 1);
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, sms_consent_at) VALUES
        (1, 1, 'Both', 'Both Person', 'both@test.local', '+12085550101', 'text', datetime('now')),
        (2, 1, 'Phone', 'Phone Only', NULL, '+12085550102', 'text', datetime('now')),
        (3, 1, 'Added', 'Added By Presidency', 'added@test.local', '+12085550103', 'text', NULL);
      INSERT INTO wards (id, name, sms_monthly_limit) VALUES (2, 'Second Ward EQ', 100);
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, sms_consent_at, always_email, always_text) VALUES
        (4, 2, 'Every', 'Every Way', 'every@test.local', '+12085550104', 'none', datetime('now'), 1, 1),
        (5, 2, 'NoConsent', 'Always No Consent', 'nc@test.local', '+12085550105', 'email', NULL, 0, 1);
    `);
    ({ notify, recipientById } = await import("@/lib/notify"));
    ({ textsThisMonth } = await import("@/lib/sms"));
  });

  it("texts until the monthly limit, then falls back to email", async () => {
    const r1 = await notify([recipientById(1, 1)!], { title: "Reminder", body: "Lesson Sunday", url: "/lessons/1" });
    expect(r1).toEqual({ push: 0, email: 0, text: 1, reached: 1 });
    expect(textsThisMonth(1, "notice")).toBe(1);

    // Limit (1) reached: the member with an email gets email; phone-only gets nothing this month.
    const r2 = await notify([recipientById(1, 1)!, recipientById(2, 1)!], { title: "Reminder 2", body: "Activity", url: "/" });
    expect(r2).toEqual({ push: 0, email: 1, text: 0, reached: 1 });

    const sms = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-"));
    expect(sms).toHaveLength(1);
    const body = fs.readFileSync(path.join(dir, "outbox", sms[0]), "utf8");
    expect(body).toContain("Test Ward EQ Elders Quorum: Reminder. Lesson Sunday");
    // Texts carry the short link, which opens /lessons/1.
    expect(body).toMatch(/Lesson Sunday \S+\/n\/\d+\n?$/);
  });

  it("never texts someone who hasn't agreed to texts", async () => {
    const before = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-")).length;
    const r = await notify([recipientById(3, 1)!], { title: "Hello", body: "Welcome", url: "/" });
    expect(r).toEqual({ push: 0, email: 1, text: 0, reached: 1 });
    expect(fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-")).length).toBe(before);
  });

  it("sends by email and text every time when the member chose that", async () => {
    const r = await notify([recipientById(4, 2)!], { title: "Every", body: "All ways", url: "/" });
    expect(r).toEqual({ push: 0, email: 1, text: 1, reached: 1 });
    // "Text every time" without their consent falls back to their backup choice (email).
    const r2 = await notify([recipientById(5, 2)!], { title: "NC", body: "x", url: "/" });
    expect(r2).toEqual({ push: 0, email: 1, text: 0, reached: 1 });
  });
});

describe("sign-in code texts", () => {
  it("end with the app's address and the code, so phones offer it on the sign-in page", async () => {
    process.env.APP_URL = "https://mywardlink.net";
    const { db } = await import("@/lib/db");
    db().exec("INSERT INTO members (id, name, display_name, phone, contact_pref, sms_consent_at, last_login_at) VALUES (9, 'C', 'Code Person', '+12085550109', 'text', datetime('now'), datetime('now'))");
    (await import("@/lib/orgs")).addToWard(9, 1);
    const { sendLoginCode } = await import("@/lib/login-code");
    const before = new Set(fs.readdirSync(path.join(dir, "outbox")));
    await sendLoginCode(db().prepare("SELECT * FROM members WHERE id = 9").get() as never, "phone", "tok", "042517");
    const file = fs.readdirSync(path.join(dir, "outbox")).find((f) => !before.has(f) && f.includes("5550109"))!;
    const body = fs.readFileSync(path.join(dir, "outbox", file), "utf8").trim();
    expect(body).toContain("042517 is your Test Ward EQ sign-in code");
    expect(body.split("\n").pop()).toBe("@mywardlink.net #042517");
  });
});
