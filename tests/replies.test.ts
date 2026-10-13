import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-replies-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("replies to the presidency", () => {
  let lib: typeof import("@/lib/sms-inbound");
  let conv: typeof import("@/lib/conversations");
  let d: import("better-sqlite3").Database;

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb();
    d.exec(`
      INSERT INTO wards (id, name) VALUES (1, 'Test Ward EQ');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role) VALUES
        (1, 1, 'Pres', 'Pres Person', 'pres@test.local', NULL, 'email', 'presidency'),
        (2, 1, 'Mem', 'Member Person', 'mem@test.local', '+12085550101', 'text', 'member');
      INSERT INTO messages (id, ward_id, sender_id, audience, audience_label, title, body) VALUES (7, 1, 1, 'everyone', 'Everyone', 'Move Saturday', 'Who can help?');
      INSERT INTO message_recipients (message_id, member_id) VALUES (7, 2);
    `);
    lib = await import("@/lib/sms-inbound");
    conv = await import("@/lib/conversations");
  });

  it("checks Twilio's signature", () => {
    const params = { From: "+12085550101", Body: "Yes I can help Saturday", To: "+12083579951", MessageSid: "SM123" };
    const url = "https://example.ts.net/api/sms/inbound";
    expect(lib.validTwilioSignature(url, params, "2QkxkoYJBQPseqtE5UxwlN//t4Q=", "secret-token")).toBe(true);
    expect(lib.validTwilioSignature(url, { ...params, Body: "changed" }, "2QkxkoYJBQPseqtE5UxwlN//t4Q=", "secret-token")).toBe(false);
    expect(lib.validTwilioSignature(url, params, "", "secret-token")).toBe(false);
  });

  it("saves a member's text as a reply to their latest message and tells the presidency", async () => {
    expect(await lib.handleInboundText({ From: "+12085550101", Body: "Yes I can help Saturday" })).toBe("saved");
    const thread = conv.conversation(2);
    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({ direction: "in", via: "text", message_title: "Move Saturday", body: "Yes I can help Saturday" });
    expect(conv.unreadReplies(1)).toBe(1);
    const mail = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("pres@"));
    expect(fs.readFileSync(path.join(dir, "outbox", mail[0]), "utf8")).toContain("Reply from Member Person");
  });

  it("ignores unknown numbers and HELP, and stops texting on STOP", async () => {
    expect(await lib.handleInboundText({ From: "+12085559999", Body: "hi" })).toBe("unknown_sender");
    expect(await lib.handleInboundText({ From: "+12085550101", Body: "HELP" })).toBe("ignored");
    expect(await lib.handleInboundText({ From: "+12085550101", Body: "Stop", OptOutType: "STOP" })).toBe("opted_out");
    expect(d.prepare("SELECT contact_pref FROM members WHERE id = 2").get()).toEqual({ contact_pref: "email" });
    expect(conv.conversation(2)).toHaveLength(1);
  });

  it("sends the presidency's answer and tracks what the member has read", async () => {
    expect(await conv.sendAnswer({ id: 1, ward_id: 1, display_name: "Pres Person" }, 2, "Thanks! See you at 9.")).toBe(true);
    expect(conv.unreadAnswers(2)).toBe(1);
    conv.markRead(2, "out");
    expect(conv.unreadAnswers(2)).toBe(0);
    expect(conv.wardConversations(1)[0]).toMatchObject({ member_name: "Member Person", last_direction: "out", unread: 1 });
  });
});
