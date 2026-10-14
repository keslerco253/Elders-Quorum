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
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'Test Ward EQ');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role) VALUES
        (1, 1, 'Pres', 'Pres Person', 'pres@test.local', NULL, 'email', 'presidency'),
        (3, 1, 'Couns', 'Counselor Person', 'couns@test.local', NULL, 'email', 'presidency'),
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
    const thread = conv.conversation(1, 2, { private: false });
    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({ direction: "in", via: "text", message_title: "Move Saturday", body: "Yes I can help Saturday" });
    expect(conv.unreadReplies(1, 1)).toBe(1);
    const mail = fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes("pres@"));
    expect(fs.readFileSync(path.join(dir, "outbox", mail[0]), "utf8")).toContain("Reply from Member Person");
  });

  it("ignores unknown numbers and HELP, and stops texting on STOP", async () => {
    expect(await lib.handleInboundText({ From: "+12085559999", Body: "hi" })).toBe("unknown_sender");
    expect(await lib.handleInboundText({ From: "+12085550101", Body: "HELP" })).toBe("ignored");
    expect(await lib.handleInboundText({ From: "+12085550101", Body: "Stop", OptOutType: "STOP" })).toBe("opted_out");
    expect(d.prepare("SELECT contact_pref FROM members WHERE id = 2").get()).toEqual({ contact_pref: "email" });
    expect(conv.conversation(1, 2, { private: false })).toHaveLength(1);
  });

  it("sends the presidency's answer and tracks what the member has read", async () => {
    expect(await conv.sendAnswer({ id: 1, org_id: 1, display_name: "Pres Person" }, 2, "Thanks! See you at 9.")).toBe(true);
    expect(conv.unreadAnswers(2)).toBe(1);
    conv.markAnswersRead(2, 1);
    expect(conv.unreadAnswers(2)).toBe(0);
    expect(conv.wardConversations(1, 1)[0]).toMatchObject({ member_name: "Member Person", last_direction: "out", unread: 1 });
  });

  it("keeps a private message between the member and that one presidency member", async () => {
    d.exec("UPDATE members SET contact_pref = 'email' WHERE id = 2");
    const before = fs.readdirSync(path.join(dir, "outbox")).length;
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Member Person" }, "Something confidential", "app", null, { private: true, withId: 1 });
    const sent = fs.readdirSync(path.join(dir, "outbox")).slice(before);
    // Only the president is told, and the words aren't in the notification.
    expect(sent.some((f) => f.includes("couns@"))).toBe(false);
    const mail = fs.readFileSync(path.join(dir, "outbox", sent.find((f) => f.includes("pres@"))!), "utf8");
    expect(mail).toContain("Private message from Member Person");
    expect(mail).not.toContain("confidential");

    expect(conv.conversation(1, 2, { private: true, withId: 1 }).map((c) => c.body)).toEqual(["Something confidential"]);
    expect(conv.conversation(1, 2, { private: false }).map((c) => c.body)).not.toContain("Something confidential");
    // The counselor can't see it in their list or counts; the president can.
    expect(conv.wardConversations(1, 3).some((c) => c.recipient_id === 1)).toBe(false);
    // (1 = the earlier whole-presidency text; the private one isn't counted for them.)
    expect(conv.unreadReplies(1, 3)).toBe(1);
    expect(conv.wardConversations(1, 1).some((c) => c.recipient_id === 1)).toBe(true);
    expect(conv.unreadReplies(1, 1)).toBe(2);

    // The president answers privately; a text back from the member stays private.
    expect(await conv.sendAnswer({ id: 1, org_id: 1, display_name: "Pres Person" }, 2, "Let's talk Sunday.", true)).toBe(true);
    expect(conv.threadForTextReply(2, 1)).toEqual({ private: true, withId: 1 });
    d.exec("UPDATE members SET contact_pref = 'text', sms_consent_at = datetime('now') WHERE id = 2");
    expect(await lib.handleInboundText({ From: "+12085550101", Body: "Sunday works" })).toBe("saved");
    expect(conv.conversation(1, 2, { private: true, withId: 1 }).map((c) => c.body)).toContain("Sunday works");

    // Deleting the president's account deletes the private thread rather than exposing it.
    (await import("@/lib/accounts")).deleteAccount(1);
    expect(conv.memberConversation(2, 1).some((c) => c.body === "Something confidential")).toBe(false);
  });
});
