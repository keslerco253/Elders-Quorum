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
    const d = dbm.useTestDb();
    d.exec(`
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
    const r1 = await notify([recipientById(1)!], { title: "Reminder", body: "Lesson Sunday", url: "/lessons/1" });
    expect(r1).toEqual({ push: 0, email: 0, text: 1, reached: 1 });
    expect(textsThisMonth(1, "notice")).toBe(1);

    // Limit (1) reached: the member with an email gets email; phone-only gets nothing this month.
    const r2 = await notify([recipientById(1)!, recipientById(2)!], { title: "Reminder 2", body: "Activity", url: "/" });
    expect(r2).toEqual({ push: 0, email: 1, text: 0, reached: 1 });

    const sms = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-"));
    expect(sms).toHaveLength(1);
    const body = fs.readFileSync(path.join(dir, "outbox", sms[0]), "utf8");
    expect(body).toContain("Test Ward EQ: Reminder. Lesson Sunday");
    expect(body).toContain("/lessons/1");
  });

  it("never texts someone who hasn't agreed to texts", async () => {
    const before = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-")).length;
    const r = await notify([recipientById(3)!], { title: "Hello", body: "Welcome", url: "/" });
    expect(r).toEqual({ push: 0, email: 1, text: 0, reached: 1 });
    expect(fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-")).length).toBe(before);
  });

  it("sends by email and text every time when the member chose that", async () => {
    const r = await notify([recipientById(4)!], { title: "Every", body: "All ways", url: "/" });
    expect(r).toEqual({ push: 0, email: 1, text: 1, reached: 1 });
    // "Text every time" without their consent falls back to their backup choice (email).
    const r2 = await notify([recipientById(5)!], { title: "NC", body: "x", url: "/" });
    expect(r2).toEqual({ push: 0, email: 1, text: 0, reached: 1 });
  });
});
