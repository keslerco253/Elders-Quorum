import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-billing-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("texting by ward: none at all, cost, paid through", () => {
  let d: ReturnType<typeof import("@/lib/db").db>;
  let sms: typeof import("@/lib/sms");
  const org = (w: number) => (d.prepare("SELECT id FROM orgs WHERE ward_id = ? ORDER BY id LIMIT 1").get(w) as { id: number }).id;

  beforeAll(async () => {
    const dbm = await import("@/lib/db");
    d = dbm.useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'Texts Ward'), (2, 'Email Ward');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, sms_consent_at, is_site_owner) VALUES
        (1, 1, 'O', 'Owner', 'o@test.local', '+12085550101', datetime('now'), 1),
        (2, 2, 'E', 'Emailer', 'e@test.local', '+12085550102', datetime('now'), 0);
    `);
    // The seed runs on the first version of the database; these columns came later.
    d.prepare("UPDATE wards SET texting_enabled = 1, no_texting = 0 WHERE id = 1").run();
    d.prepare("UPDATE wards SET texting_enabled = 0, no_texting = 1 WHERE id = 2").run();
    sms = await import("@/lib/sms");
  });

  it("sends nothing at all for a ward with no texting, not even codes", async () => {
    expect(await sms.sendSms(org(2), "+12085550102", "123456 is your code", "code")).toBe("failed");
    expect(await sms.sendSms(org(1), "+12085550101", "123456 is your code", "code")).toBe("sent");
    expect(sms.canSendNotice(org(2))).toBe(false);
    expect([sms.memberTextable(1), sms.memberTextable(2)]).toEqual([true, false]);
    expect(sms.phoneOnlyMembers(2)).toBe(0);
  });

  it("works out each ward's texts by month and their cost", () => {
    sms.setTextCost(0.01);
    expect(sms.textCost()).toBe(0.01);
    const month = DateTime.utc().toFormat("yyyy-MM");
    expect(sms.textsByMonth(1)).toEqual([{ month, texts: 1 }]);
    expect(sms.textsByMonth(2)).toEqual([]);
  });

  it("reminds two weeks before the paid-through date, and turns texting off after it", async () => {
    const { collectDue } = await import("@/lib/scheduler");
    const now = DateTime.fromISO("2026-11-10T18:00:00Z");
    d.prepare("UPDATE wards SET texting_paid_through = '2026-11-20' WHERE id = 1").run();
    const soon = collectDue(now).filter((n) => n.key.startsWith("texting-"));
    expect(soon.map((n) => [n.key, n.recipients.map((r) => r.id)])).toEqual([["texting-ending:1:2026-11-20", [1]]]);
    d.prepare("UPDATE wards SET texting_paid_through = '2026-11-09' WHERE id = 1").run();
    expect(collectDue(now).filter((n) => n.key.startsWith("texting-")).map((n) => n.key)).toEqual(["texting-ended:1:2026-11-09"]);
    expect((d.prepare("SELECT texting_enabled FROM wards WHERE id = 1").get() as { texting_enabled: number }).texting_enabled).toBe(0);
  });
});
