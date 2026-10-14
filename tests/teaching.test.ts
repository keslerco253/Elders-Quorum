import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-teaching-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("teacher confirmations", () => {
  let teaching: typeof import("@/lib/teaching");
  let inbound: typeof import("@/lib/sms-inbound");
  let collectDue: typeof import("@/lib/scheduler").collectDue;
  let d: import("better-sqlite3").Database;
  const soon = DateTime.now().setZone("America/Boise").plus({ days: 3 }).toISODate()!;

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role, contact_pref, sms_consent_at) VALUES
        (1, 1, 'P', 'Pres Person', 'p@test.local', NULL, 'presidency', 'email', NULL),
        (2, 1, 'T', 'Teacher Person', 't@test.local', '+12085550111', 'member', 'text', datetime('now'));
      INSERT INTO lessons (id, ward_id, date, kind, title, teacher_id) VALUES (10, 1, '${soon}', 'talk', 'Abide', 2), (20, 1, '2030-11-03', 'talk', 'Later', 2);
    `);
    teaching = await import("@/lib/teaching");
    inbound = await import("@/lib/sms-inbound");
    ({ collectDue } = await import("@/lib/scheduler"));
  });

  it("makes a private link that only works for that teacher and lesson", () => {
    const t = teaching.teachToken(10, 2);
    expect(teaching.validTeachToken(10, 2, t)).toBe(true);
    expect(teaching.validTeachToken(10, 3, t)).toBe(false);
    expect(teaching.validTeachToken(11, 2, t)).toBe(false);
    expect(teaching.validTeachToken(10, 2, "nope")).toBe(false);
    expect(teaching.respondPath(10, 2, "cant")).toBe(`/teach/10?t=${t}&a=cant`);
  });

  it("reads TEACH and CANT text replies", () => {
    expect(inbound.parseTeachReply("Teaching!")).toEqual({ answer: "teach" });
    expect(inbound.parseTeachReply("teach")).toEqual({ answer: "teach" });
    expect(inbound.parseTeachReply("CANT out of town")).toEqual({ answer: "cant", reason: "out of town" });
    expect(inbound.parseTeachReply("Can’t, sick kids")).toEqual({ answer: "cant", reason: "sick kids" });
    expect(inbound.parseTeachReply("cannot")).toEqual({ answer: "cant", reason: "" });
    expect(inbound.parseTeachReply("I can help Saturday")).toBeNull();
    expect(inbound.parseTeachReply("Teacher's notes look great")).toBeNull();
  });

  it("asks an unconfirmed teacher to reply, with buttons and text keywords", () => {
    const sat = DateTime.fromISO("2030-11-02T08:30", { zone: "America/Boise" }).toUTC();
    const n = collectDue(sat).find((x) => x.key.startsWith("lesson-teacher"))!;
    expect(n.payload.actions!.map((a) => a.title)).toEqual(["I'll be teaching", "I can't teach"]);
    expect(n.payload.textBody).toContain("Reply TEACH");
    expect(n.payload.url).toContain("/teach/20?t=");
    // Once confirmed, the reminder just thanks them (no buttons).
    d.exec("UPDATE lessons SET teacher_confirmed_at = datetime('now') WHERE id = 20");
    const after = collectDue(sat).find((x) => x.key.startsWith("lesson-teacher"))!;
    expect(after.payload.actions).toBeUndefined();
    expect(after.payload.body).toContain("Thanks for confirming");
  });

  it("confirms by text, then declines by text with a reason", async () => {
    expect(await inbound.handleInboundText({ From: "+12085550111", Body: "Teach" })).toBe("teacher_confirmed");
    expect(d.prepare("SELECT teacher_confirmed_at IS NOT NULL AS c, teacher_id FROM lessons WHERE id = 10").get()).toEqual({ c: 1, teacher_id: 2 });

    expect(await inbound.handleInboundText({ From: "+12085550111", Body: "Can't - family emergency" })).toBe("teacher_declined");
    expect(d.prepare("SELECT teacher_confirmed_at, teacher_id FROM lessons WHERE id = 10").get()).toEqual({ teacher_confirmed_at: null, teacher_id: null });
    expect(d.prepare("SELECT reason FROM lesson_declines WHERE lesson_id = 10").get()).toEqual({ reason: "family emergency" });
    const mail = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("p@test"));
    expect(fs.readFileSync(path.join(dir, "outbox", mail[mail.length - 1]), "utf8")).toContain("Reason: family emergency");

    // No longer teaching anything: "teach" is just a normal reply to the presidency.
    expect(await inbound.handleInboundText({ From: "+12085550111", Body: "Teaching is fun" })).toBe("saved");
  });
});
