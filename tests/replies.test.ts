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
    const params = {
      From: "+12085550101",
      Body: "Yes I can help Saturday",
      To: "+12083579951",
      MessageSid: "SM123",
    };
    const url = "https://example.ts.net/api/sms/inbound";
    expect(
      lib.validTwilioSignature(
        url,
        params,
        "2QkxkoYJBQPseqtE5UxwlN//t4Q=",
        "secret-token",
      ),
    ).toBe(true);
    expect(
      lib.validTwilioSignature(
        url,
        { ...params, Body: "changed" },
        "2QkxkoYJBQPseqtE5UxwlN//t4Q=",
        "secret-token",
      ),
    ).toBe(false);
    expect(lib.validTwilioSignature(url, params, "", "secret-token")).toBe(
      false,
    );
  });

  it("saves a member's text as a reply to their latest message and tells the presidency", async () => {
    expect(
      await lib.handleInboundText({
        From: "+12085550101",
        Body: "Yes I can help Saturday",
      }),
    ).toBe("saved");
    const thread = conv.conversation(1, 2, { private: false });
    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({
      direction: "in",
      via: "text",
      message_title: "Move Saturday",
      body: "Yes I can help Saturday",
    });
    expect(conv.unreadReplies(1, 1)).toBe(1);
    const mail = fs
      .readdirSync(path.join(dir, "outbox"))
      .filter((f) => f.includes("pres@"));
    expect(
      fs.readFileSync(path.join(dir, "outbox", mail[0]), "utf8"),
    ).toContain("Reply from Member Person");
  });

  it("ignores unknown numbers and HELP, and stops texting on STOP", async () => {
    expect(
      await lib.handleInboundText({ From: "+12085559999", Body: "hi" }),
    ).toBe("unknown_sender");
    expect(
      await lib.handleInboundText({ From: "+12085550101", Body: "HELP" }),
    ).toBe("ignored");
    expect(
      await lib.handleInboundText({
        From: "+12085550101",
        Body: "Stop",
        OptOutType: "STOP",
      }),
    ).toBe("opted_out");
    expect(
      d.prepare("SELECT contact_pref FROM members WHERE id = 2").get(),
    ).toEqual({ contact_pref: "email" });
    expect(conv.conversation(1, 2, { private: false })).toHaveLength(1);
  });

  it("sends the presidency's answer and tracks what the member has read", async () => {
    const before = new Set(fs.readdirSync(path.join(dir, "outbox")));
    expect(
      await conv.sendAnswer(
        { id: 1, org_id: 1, display_name: "Pres Person" },
        2,
        "Thanks! See you at 9.",
      ),
    ).toBe(true);
    expect(conv.unreadAnswers(2)).toBe(1);
    // A personal note: just the words, signed, with no ward header or link.
    const mail = fs
      .readdirSync(path.join(dir, "outbox"))
      .find((f) => !before.has(f) && f.includes("mem@"))!;
    const text = fs.readFileSync(path.join(dir, "outbox", mail), "utf8");
    expect(text).toBe(
      "To: mem@test.local\nSubject: A message from Pres Person\n\nThanks! See you at 9.\n\n- Pres Person\n",
    );
    d.exec(
      "UPDATE members SET contact_pref = 'text', sms_consent_at = datetime('now') WHERE id = 2",
    );
    const before2 = new Set(fs.readdirSync(path.join(dir, "outbox")));
    await conv.sendAnswer(
      { id: 1, org_id: 1, display_name: "Pres Person" },
      2,
      "Running 5 minutes late.",
    );
    const sms = fs
      .readdirSync(path.join(dir, "outbox"))
      .find((f) => !before2.has(f) && f.includes("sms-"))!;
    expect(fs.readFileSync(path.join(dir, "outbox", sms), "utf8")).toBe(
      "SMS To: +12085550101\n\nRunning 5 minutes late.\n\n- Pres Person\n",
    );
    d.exec(
      "UPDATE members SET contact_pref = 'email', sms_consent_at = NULL WHERE id = 2",
    );
    conv.markAnswersRead(2, 1);
    conv.markAnswersRead(2, 1);
    expect(conv.unreadAnswers(2)).toBe(0);
    expect(conv.wardConversations(1, 1)[0]).toMatchObject({
      member_name: "Member Person",
      last_direction: "out",
      // Answered, so it's no longer waiting on anyone.
      unread: 0,
    });
  });

  it("keeps a private message between the member and that one presidency member", async () => {
    d.exec("UPDATE members SET contact_pref = 'email' WHERE id = 2");
    const before = fs.readdirSync(path.join(dir, "outbox")).length;
    await conv.receiveReply(
      { id: 2, org_id: 1, display_name: "Member Person" },
      "Something confidential",
      "app",
      null,
      { private: true, withId: 1 },
    );
    const sent = fs.readdirSync(path.join(dir, "outbox")).slice(before);
    // Only the president is told.
    expect(sent.some((f) => f.includes("couns@"))).toBe(false);
    const mail = fs.readFileSync(
      path.join(dir, "outbox", sent.find((f) => f.includes("pres@"))!),
      "utf8",
    );
    expect(mail).toContain("Private message from Member Person");
    // The words stay in the app, in case someone else sees the inbox.
    expect(mail).not.toContain("Something confidential");

    expect(
      conv.conversation(1, 2, { private: true, withId: 1 }).map((c) => c.body),
    ).toEqual(["Something confidential"]);
    expect(
      conv.conversation(1, 2, { private: false }).map((c) => c.body),
    ).not.toContain("Something confidential");
    // The counselor can't see it in their list or counts; the president can.
    expect(conv.wardConversations(1, 3).some((c) => c.recipient_id === 1)).toBe(
      false,
    );
    // (1 = the earlier whole-presidency text; the private one isn't counted for them.)
    expect(conv.unreadReplies(1, 3)).toBe(1);
    expect(conv.wardConversations(1, 1).some((c) => c.recipient_id === 1)).toBe(
      true,
    );
    expect(conv.unreadReplies(1, 1)).toBe(2);

    // The president answers privately; a text back from the member stays private.
    expect(
      await conv.sendAnswer(
        { id: 1, org_id: 1, display_name: "Pres Person" },
        2,
        "Let's talk Sunday.",
        true,
      ),
    ).toBe(true);
    expect(conv.threadForTextReply(2, 1)).toEqual({ private: true, withId: 1 });
    d.exec(
      "UPDATE members SET contact_pref = 'text', sms_consent_at = datetime('now') WHERE id = 2",
    );
    expect(
      await lib.handleInboundText({
        From: "+12085550101",
        Body: "Sunday works",
      }),
    ).toBe("saved");
    expect(
      conv.conversation(1, 2, { private: true, withId: 1 }).map((c) => c.body),
    ).toContain("Sunday works");

    // Deleting the president's account deletes the private thread rather than exposing it.
    (await import("@/lib/accounts")).deleteAccount(1);
    expect(
      conv
        .memberConversation(2, 1)
        .some((c) => c.body === "Something confidential"),
    ).toBe(false);
  });

  it("texts a leader a private message's sender, not its words, with a link to answer", async () => {
    d.exec(
      "UPDATE members SET phone = '+12085550199', contact_pref = 'text', sms_consent_at = datetime('now') WHERE id = 3",
    );
    const before = new Set(fs.readdirSync(path.join(dir, "outbox")));
    const long = "Thanks for asking. ".repeat(20).trim();
    await conv.receiveReply(
      { id: 2, org_id: 1, display_name: "Member Person" },
      long,
      "app",
      null,
      { private: true, withId: 3 },
    );
    const sms = fs
      .readdirSync(path.join(dir, "outbox"))
      .find((f) => !before.has(f) && f.includes("sms-"))!;
    const text = fs.readFileSync(path.join(dir, "outbox", sms), "utf8");
    // Private: who it's from and a short link, but not the words (someone else may see the phone).
    expect(text).toContain("Private message from Member Person");
    expect(text).not.toContain("Thanks for asking");
    const link = text.match(/(\S+\/n\/\d+)/)![1];
    expect(link).toMatch(/\/n\/\d+$/);
    const { shortLinkTarget } = await import("@/lib/notification-log");
    const nid = Number(link.split("/").pop());
    const to = (await import("@/lib/db")).db().prepare("SELECT member_id FROM notification_log WHERE id = ?").get(nid) as { member_id: number };
    expect(shortLinkTarget(nid, to.member_id)).toMatch(/\/admin\/replies\/2\?private=1&n=\d+&org=1#end$/);
    // Anyone else (or no one signed in) just goes home: the link doesn't reveal where it points.
    expect(shortLinkTarget(nid, null)).toBe("/");
    expect(shortLinkTarget(nid, 2)).toBe("/");

    // The leader texts back: it isn't sent to anyone; they're told to answer in the app, with a link to that conversation.
    const beforeAnswer = new Set(fs.readdirSync(path.join(dir, "outbox")));
    const out: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: "+12085550199", Body: "Happy to help. I'll call you tonight." }, out)).toBe("leader_use_app");
    expect(out.reply).toMatch(/^My Ward Link: texted replies to members aren't sent\. Please answer in the app: \S+\/admin\/replies\/2\?org=1&private=1#end$/);
    expect(conv.conversation(1, 2, { private: true, withId: 3 }).at(-1)).toMatchObject({ direction: "in" });
    expect(fs.readdirSync(path.join(dir, "outbox")).filter((f) => !beforeAnswer.has(f) && f.includes("12085550101"))).toEqual([]);
    expect(d.prepare("SELECT result, note FROM sms_inbound_log ORDER BY id DESC LIMIT 1").get()).toEqual({ result: "leader_use_app", note: "A leader's texted reply (not sent: answer in the app)" });
    // Long after, with nothing to answer: still not sent on (it could reach someone who wrote long ago).
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-10 days'); UPDATE members SET text_reply_member_id = NULL WHERE id = 3");
    const later: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: "+12085550199", Body: "No picture" }, later)).toBe("leader_use_app");
    expect(later.reply).toMatch(/\/messages$/);
    d.exec(
      "UPDATE members SET phone = NULL, contact_pref = 'email', sms_consent_at = NULL WHERE id = 3",
    );
  });
});

describe("a leader's texted reply", () => {
  let lib: typeof import("@/lib/sms-inbound");
  let conv: typeof import("@/lib/conversations");
  const leaderPhone = "+12085550177";

  beforeAll(async () => {
    (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'Test Ward EQ');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role, sms_consent_at) VALUES
        (1, 1, 'Pres', 'Pres Person', 'pres@test.local', '${leaderPhone}', 'text', 'presidency', datetime('now')),
        (2, 1, 'Hyrum', 'Hyrum Johnson', 'hyrum@test.local', NULL, 'email', 'member', NULL),
        (4, 1, 'Jane', 'Jane Smith', 'jane@test.local', NULL, 'email', 'member', NULL);
    `);
    lib = await import("@/lib/sms-inbound");
    conv = await import("@/lib/conversations");
  });
  const last = (memberId: number) => conv.conversation(1, memberId, { private: true, withId: 1 }).at(-1);

  it("is never sent to a member, whoever wrote: answers go through the app", async () => {
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Can you help Saturday?", "app", null, { private: true, withId: 1 });
    await conv.receiveReply({ id: 4, org_id: 1, display_name: "Jane Smith" }, "Is the activity still on?", "app", null, { private: true, withId: 1 });
    for (const body of ["Yes, see you at 9", "Hyrum, see you at 9", "1"]) {
      const out: { reply?: string } = {};
      expect(await lib.handleInboundText({ From: leaderPhone, Body: body }, out)).toBe("leader_use_app");
      expect(out.reply).toMatch(/Please answer in the app/);
    }
    expect(last(2)?.direction).toBe("in");
    expect(last(4)?.direction).toBe("in");
  });

  it("treats a leader's text back to their own visit invitation as their reply to the presidency", async () => {
    const { notify, recipientById } = await import("@/lib/notify");
    await notify([recipientById(1, 1)!], { title: "An invitation", body: "Hi Pres! We would love to visit Friday at 7.", url: "/visit-invite/1", textLink: "Reply here", asMember: true });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Friday works for us" })).toBe("saved");
    expect(conv.memberConversation(1, 1).at(-1)).toMatchObject({ direction: "in", body: "Friday works for us", recipient_id: null });
    // After a leader's notice, a text back is a leader's again: not sent.
    await notify([recipientById(1, 1)!], { title: "Reminder", body: "Lesson Sunday", url: "/lessons" });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes, I'll call you" })).toBe("leader_use_app");
  });

  it("still answers TEACH and CANT for their own lesson", async () => {
    const d = (await import("@/lib/db")).db();
    d.prepare("INSERT INTO lessons (org_id, date, kind, teacher_id) VALUES (1, date('now', '+3 days'), 'talk', 1)").run();
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "TEACH" })).toBe("teacher_confirmed");
  });
});

describe("a leader's inbox", () => {
  let conv: typeof import("@/lib/conversations");
  let orgs: typeof import("@/lib/orgs");

  beforeAll(async () => {
    (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'Villas Ward EQ');
      INSERT INTO members (id, ward_id, name, display_name, email, contact_pref, role) VALUES
        (1, 1, 'Pres', 'Pres Person', 'pres@test.local', 'email', 'presidency'),
        (2, 1, 'Hyrum', 'Hyrum Johnson', 'hyrum@test.local', 'email', 'member'),
        (3, 1, 'Jane', 'Jane Smith', 'jane@test.local', 'email', 'member');
    `);
    conv = await import("@/lib/conversations");
    orgs = await import("@/lib/orgs");
  });

  it("lists every conversation in every organization the leader leads, with unread and search filters", async () => {
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 1 });
    const mapleOrg = orgs.wardOrg(maple.id).id;
    orgs.addToOrg(3, mapleOrg);
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Ride Sunday?", "app", null);
    await conv.receiveReply({ id: 3, org_id: mapleOrg, display_name: "Jane Smith" }, "Projector?", "app", null, { private: true, withId: 1 });
    await conv.sendAnswer({ id: 1, org_id: 1, display_name: "Pres Person" }, 2, "Yes, 8:30");
    conv.markThreadRead(1, 2, { private: false }, 1);

    const rows = conv.leaderInbox(1);
    expect(rows.map((r) => [r.member_name, r.org_label, r.recipient_id !== null, r.unread])).toEqual([
      ["Hyrum Johnson", "Villas Ward EQ · Elders Quorum", false, 0],
      ["Jane Smith", "Maple Ward", true, 1],
    ]);
    expect(rows[0]).toMatchObject({ last_direction: "out", last_author_id: 1, last_body: "Yes, 8:30" });
    expect(conv.leaderInbox(1, { unreadOnly: true }).map((r) => r.member_name)).toEqual(["Jane Smith"]);
    expect(conv.leaderInbox(1, { q: "hyr" }).map((r) => r.member_name)).toEqual(["Hyrum Johnson"]);
    expect(conv.leaderUnread(1)).toBe(1);
    // Members (who lead nothing) have no inbox.
    expect(conv.leaderInbox(2)).toEqual([]);
  });
});

describe("message times", () => {
  it("read like a phone's message list", async () => {
    const { friendlyTime } = await import("@/lib/time");
    const { DateTime } = await import("luxon");
    const now = DateTime.fromISO("2026-10-15T20:00:00Z"); // Thu Oct 15, 2:00 PM in Boise
    const tz = "America/Boise";
    expect(friendlyTime("2026-10-15 15:30:00", tz, now)).toBe("9:30 AM");
    expect(friendlyTime("2026-10-14 15:30:00", tz, now)).toBe("Yesterday");
    expect(friendlyTime("2026-10-12 15:30:00", tz, now)).toBe("Monday");
    expect(friendlyTime("2026-10-01 15:30:00", tz, now)).toBe("Oct 1");
    expect(friendlyTime("2025-12-24 15:30:00", tz, now)).toBe("Dec 24, 2025");
  });
});
