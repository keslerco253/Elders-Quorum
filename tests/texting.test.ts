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
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref) VALUES
        (1, 1, 'Both', 'Both Person', 'both@test.local', '+12085550101', 'text'),
        (2, 1, 'Phone', 'Phone Only', NULL, '+12085550102', 'text');
    `);
    ({ notify, recipientById } = await import("@/lib/notify"));
    ({ textsThisMonth } = await import("@/lib/sms"));
  });

  it("texts until the monthly limit, then falls back to email", async () => {
    const r1 = await notify([recipientById(1)!], { title: "Reminder", body: "Lesson Sunday", url: "/lessons/1" });
    expect(r1).toEqual({ push: 0, email: 0, text: 1 });
    expect(textsThisMonth(1, "notice")).toBe(1);

    // Limit (1) reached: the member with an email gets email; phone-only gets nothing this month.
    const r2 = await notify([recipientById(1)!, recipientById(2)!], { title: "Reminder 2", body: "Activity", url: "/" });
    expect(r2).toEqual({ push: 0, email: 1, text: 0 });

    const sms = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("sms-"));
    expect(sms).toHaveLength(1);
    const body = fs.readFileSync(path.join(dir, "outbox", sms[0]), "utf8");
    expect(body).toContain("Test Ward EQ: Reminder. Lesson Sunday");
    expect(body).toContain("/lessons/1");
  });
});
