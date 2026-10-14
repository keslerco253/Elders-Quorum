import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-asks-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("asking a member to teach", () => {
  let tr: typeof import("@/lib/teaching-requests");
  let inbound: typeof import("@/lib/sms-inbound");
  let d: import("better-sqlite3").Database;
  const pres = { id: 1, org_id: 1, display_name: "Pres Person" };
  const lesson = (id: number) => d.prepare("SELECT teacher_id, teacher_confirmed_at IS NOT NULL AS confirmed FROM lessons WHERE id = ?").get(id);
  const outbox = () => fs.readdirSync(path.join(dir, "outbox"));

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role, contact_pref, sms_consent_at) VALUES
        (1, 1, 'P', 'Pres Person', 'p@test.local', NULL, 'presidency', 'email', NULL),
        (2, 1, 'A', 'Alma Member', 'a@test.local', NULL, 'member', 'email', NULL),
        (3, 1, 'B', 'Ben Member', 'b@test.local', '+12085550133', 'member', 'text', datetime('now'));
      INSERT INTO lessons (id, ward_id, date, kind, title, speaker) VALUES (1, 1, '2030-03-03', 'talk', 'Abide', 'Elder X'), (2, 1, '2030-03-10', 'talk', 'Faith', '');
    `);
    tr = await import("@/lib/teaching-requests");
    inbound = await import("@/lib/sms-inbound");
  });

  it("sends the request with a private link and refuses duplicates", async () => {
    expect(await tr.askToTeach(pres, 1, 2, "We'd love to have you.", "2030-01-01")).toBeNull();
    const mail = fs.readFileSync(path.join(dir, "outbox", outbox().find((f) => f.includes("a@test"))!), "utf8");
    expect(mail).toContain("Will you teach on Sun, Mar 3?");
    expect(mail).toMatch(/\/ask\/\d+\?t=/);
    expect(await tr.askToTeach(pres, 1, 2, "", "2030-01-01")).toMatch(/already asked/);
    expect(await tr.askToTeach(pres, 1, 3, "", "2030-01-01")).toBeNull();
    expect(tr.requestsForLesson(1).map((r) => r.status)).toEqual(["pending", "pending"]);
  });

  it("accepting assigns and confirms them, and withdraws the other requests", async () => {
    const alma = tr.requestsForLesson(1).find((r) => r.member_id === 2)!;
    expect(await tr.answerRequest(alma.id, 3, true)).toBe("closed"); // wrong member
    expect(await tr.answerRequest(alma.id, 2, true)).toBe("accepted");
    expect(lesson(1)).toEqual({ teacher_id: 2, confirmed: 1 });
    expect(tr.requestsForLesson(1).find((r) => r.member_id === 3)!.status).toBe("cancelled");
    const mail = fs.readFileSync(path.join(dir, "outbox", outbox().filter((f) => f.includes("p@test")).pop()!), "utf8");
    expect(mail).toContain("Alma Member will teach on Sun, Mar 3");
  });

  it("declines by text with a reason, and accepts by text", async () => {
    await tr.askToTeach(pres, 2, 3, "", "2030-01-01");
    expect(await inbound.handleInboundText({ From: "+12085550133", Body: "Cant - traveling for work" })).toBe("request_declined");
    expect(tr.requestsForLesson(2)[0]).toMatchObject({ status: "declined", reason: "traveling for work" });
    expect(lesson(2)).toEqual({ teacher_id: null, confirmed: 0 });
    await tr.askToTeach(pres, 2, 3, "", "2030-01-01");
    expect(await inbound.handleInboundText({ From: "+12085550133", Body: "teach" })).toBe("request_accepted");
    expect(lesson(2)).toEqual({ teacher_id: 3, confirmed: 1 });
  });

  it("tells a late yes that someone else is already teaching", async () => {
    d.exec("INSERT INTO lessons (id, org_id, date, kind, title) VALUES (3, 1, '2030-03-17', 'talk', 'Hope')");
    await tr.askToTeach(pres, 3, 2, "", "2030-01-01");
    d.exec("UPDATE lessons SET teacher_id = 3 WHERE id = 3");
    const r = tr.requestsForLesson(3)[0];
    expect(await tr.answerRequest(r.id, 2, true)).toBe("taken");
    expect(lesson(3)).toMatchObject({ teacher_id: 3 });
  });
});
