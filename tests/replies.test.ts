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
      unread: 1,
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
    // The one presidency member reads the whole message in the email (and only they get it).
    expect(mail).toContain("Something confidential");

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

  it("texts a leader the member's whole message, with a link to answer", async () => {
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
    // Short: who it's from, their words, and a short link to the conversation.
    expect(text).toContain(`${long}\n\nMember Person (private)\n\nReply in app: `);
    const link = text.match(/Reply in app: (\S+)/)![1];
    expect(link).toMatch(/\/n\/\d+$/);
    const { shortLinkTarget } = await import("@/lib/notification-log");
    const nid = Number(link.split("/").pop());
    const to = (await import("@/lib/db")).db().prepare("SELECT member_id FROM notification_log WHERE id = ?").get(nid) as { member_id: number };
    expect(shortLinkTarget(nid, to.member_id)).toMatch(/\/admin\/replies\/2\?private=1&n=\d+&org=1#end$/);
    // Anyone else (or no one signed in) just goes home: the link doesn't reveal where it points.
    expect(shortLinkTarget(nid, null)).toBe("/");
    expect(shortLinkTarget(nid, 2)).toBe("/");

    // The leader replies to that text: it goes to the member, privately, like answering in the app.
    const beforeAnswer = new Set(fs.readdirSync(path.join(dir, "outbox")));
    expect(await lib.handleInboundText({ From: "+12085550199", Body: "Happy to help. I'll call you tonight." })).toBe("answer_sent");
    const thread = conv.conversation(1, 2, { private: true, withId: 3 });
    expect(thread[thread.length - 1]).toMatchObject({ direction: "out", body: "Happy to help. I'll call you tonight." });
    const toMember = fs.readdirSync(path.join(dir, "outbox")).find((f) => !beforeAnswer.has(f) && f.includes("12085550101"))!;
    expect(fs.readFileSync(path.join(dir, "outbox", toMember), "utf8")).toContain("Happy to help. I'll call you tonight.\n\n- Counselor Person");
    // Replying to an older text (sent before this, or after other texts) still answers the
    // newest message a member sent them in the last few days.
    d.exec("UPDATE members SET text_reply_member_id = NULL WHERE id = 3");
    expect(await lib.handleInboundText({ From: "+12085550199", Body: "One more thing" })).toBe("answer_sent");
    expect(conv.conversation(1, 2, { private: true, withId: 3 }).at(-1)).toMatchObject({ direction: "out", body: "One more thing" });
    // The site owner's log says where each text went.
    expect(d.prepare("SELECT result, note FROM sms_inbound_log ORDER BY id DESC LIMIT 1").get()).toEqual({ result: "answer_sent", note: "Answer to Member Person (private)" });
    // With no member message to answer, a leader's text is their own message, and they aren't notified of it themselves.
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-10 days')");
    const beforeOwn = new Set(fs.readdirSync(path.join(dir, "outbox")));
    expect(await lib.handleInboundText({ From: "+12085550199", Body: "A note from me" })).toBe("saved");
    expect(fs.readdirSync(path.join(dir, "outbox")).filter((f) => !beforeOwn.has(f) && f.includes("12085550199"))).toEqual([]);
    d.exec(
      "UPDATE members SET phone = NULL, contact_pref = 'email', sms_consent_at = NULL WHERE id = 3",
    );
  });
});

describe("a leader's texted reply when two people write at once", () => {
  let lib: typeof import("@/lib/sms-inbound");
  let conv: typeof import("@/lib/conversations");
  let d: import("better-sqlite3").Database;
  const leaderPhone = "+12085550177";

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
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

  it("asks who it's for, then sends the held reply to the person picked", async () => {
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Can you help Saturday?", "app", null, { private: true, withId: 1 });
    // Jane's message arrives while the leader is typing their answer to Hyrum.
    await conv.receiveReply({ id: 4, org_id: 1, display_name: "Jane Smith" }, "Is the activity still on?", "app", null, { private: true, withId: 1 });
    const out: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes, see you at 9" }, out)).toBe("asked_who");
    expect(out.reply).toBe("Who is this for? Reply 1 for Jane Smith or 2 for Hyrum Johnson.");
    expect(last(2)?.direction).toBe("in");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "2" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "Yes, see you at 9" });
    expect(last(4)?.direction).toBe("in");
  });

  it("sends a reply that starts with a name straight to that person", async () => {
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Jane, yes it's at 7pm at the church" })).toBe("answer_sent");
    expect(last(4)).toMatchObject({ direction: "out", body: "Jane, yes it's at 7pm at the church" });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Hyrum Johnson: bring a ladder" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "bring a ladder" });
    // A comma after a word that isn't someone's name is an ordinary reply (here two people
    // just wrote, so the app asks who it's for rather than treating "Sure" as a name).
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Sure, no problem" })).toBe("asked_who");
  });

  it("asks when two people are both waiting for an answer, even if they wrote a while ago", async () => {
    d.exec("DELETE FROM member_messages; DELETE FROM sms_pending");
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Ride Sunday?", "app", null, { private: true, withId: 1 });
    await conv.receiveReply({ id: 4, org_id: 1, display_name: "Jane Smith" }, "Snacks?", "app", null, { private: true, withId: 1 });
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-14 minutes')");
    const out: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes, 8:30" }, out)).toBe("asked_who");
    expect(out.reply).toBe("Who is this for? Reply 1 for Jane Smith or 2 for Hyrum Johnson.");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "2" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "Yes, 8:30" });
    // Hyrum's answered, so Jane is the only one waiting: the next reply goes to her without asking.
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Bring fruit" })).toBe("answer_sent");
    expect(last(4)).toMatchObject({ direction: "out", body: "Bring fruit" });
  });

  it("asks whenever two or more people are still waiting, however long ago they wrote (within 3 days)", async () => {
    d.exec("DELETE FROM member_messages; DELETE FROM sms_pending");
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Ride Sunday?", "app", null, { private: true, withId: 1 });
    await conv.receiveReply({ id: 4, org_id: 1, display_name: "Jane Smith" }, "Snacks?", "app", null, { private: true, withId: 1 });
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-16 minutes')");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes" })).toBe("asked_who");
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-2 days')");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes" })).toBe("asked_who");
    // Older than 3 days isn't a conversation anymore: the reply is the leader's own message.
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-4 days'); DELETE FROM sms_pending; UPDATE members SET text_reply_member_id = NULL");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Hello" })).toBe("saved");
  });

  it("lists everyone who just wrote", async () => {
    d.exec(`INSERT INTO members (id, name, display_name, email, contact_pref, status) VALUES
      (5, 'A', 'Amy Allen', 'amy@test.local', 'email', 'active'), (6, 'B', 'Ben Brown', 'ben@test.local', 'email', 'active')`);
    const { addToOrg } = await import("@/lib/orgs");
    addToOrg(5, 1);
    addToOrg(6, 1);
    for (const [id, name] of [[2, "Hyrum Johnson"], [4, "Jane Smith"], [5, "Amy Allen"], [6, "Ben Brown"]] as const)
      await conv.receiveReply({ id, org_id: 1, display_name: name }, "Question", "app", null, { private: true, withId: 1 });
    const out: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes" }, out)).toBe("asked_who");
    expect(out.reply).toBe("Who is this for? Reply 1 for Ben Brown, 2 for Amy Allen, 3 for Jane Smith, or 4 for Hyrum Johnson.");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "4" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "Yes" });
  });

  it("asks which one when two people who wrote have that first name", async () => {
    d.exec("DELETE FROM member_messages; DELETE FROM sms_pending");
    d.exec(`INSERT INTO members (id, name, display_name, email, contact_pref, status) VALUES (7, 'H', 'Hyrum Smith', 'hs@test.local', 'email', 'active')`);
    (await import("@/lib/orgs")).addToOrg(7, 1);
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Ride?", "app", null, { private: true, withId: 1 });
    await conv.receiveReply({ id: 7, org_id: 1, display_name: "Hyrum Smith" }, "Chairs?", "app", null, { private: true, withId: 1 });
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-1 hour')");
    await conv.sendAnswer({ id: 1, org_id: 1, display_name: "Pres Person" }, 7, "Got it", true);
    const out: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Hyrum, 8:30 works" }, out)).toBe("asked_who");
    expect(out.reply).toBe("Who is this for? Reply 1 for Hyrum Smith or 2 for Hyrum Johnson.");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "2" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "Hyrum, 8:30 works" });
    // The full name picks one directly.
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Hyrum Smith, thanks" })).toBe("answer_sent");
    expect(last(7)).toMatchObject({ direction: "out", body: "Hyrum Smith, thanks" });
  });

  it("covers every ward and organization the leader leads", async () => {
    d.exec("DELETE FROM member_messages; DELETE FROM sms_pending");
    const orgs = await import("@/lib/orgs");
    // The leader also leads a second ward, where Kate writes to them.
    const maple = orgs.createWard({ name: "Maple Ward", timezone: "America/Boise", creatorId: 1, calling: "bishop" });
    const mapleOrg = orgs.wardOrg(maple.id).id;
    d.exec(`INSERT INTO members (id, name, display_name, email, contact_pref, status) VALUES (8, 'K', 'Kate Lee', 'kate@test.local', 'email', 'active')`);
    orgs.addToOrg(8, mapleOrg);
    await conv.receiveReply({ id: 8, org_id: mapleOrg, display_name: "Kate Lee" }, "Can I borrow the projector?", "app", null, { private: true, withId: 1 });
    // Then Hyrum writes in Villas (the last text the leader got).
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Ride?", "app", null, { private: true, withId: 1 });
    d.exec("UPDATE member_messages SET created_at = datetime('now', '-30 minutes')");
    const out: { reply?: string } = {};
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes, pick it up Friday" }, out)).toBe("asked_who");
    expect(out.reply).toBe("Who is this for? Reply 1 for Hyrum Johnson or 2 for Kate Lee.");
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "2" })).toBe("answer_sent");
    // Answered in Maple Ward, where Kate wrote.
    expect(conv.conversation(mapleOrg, 8, { private: true, withId: 1 }).at(-1)).toMatchObject({ direction: "out", body: "Yes, pick it up Friday" });
    // Kate's name works across wards too.
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Kate, it's in the library" })).toBe("answer_sent");
    expect(conv.conversation(mapleOrg, 8, { private: true, withId: 1 }).at(-1)?.body).toBe("Kate, it's in the library");
  });

  it("doesn't ask when only one person is writing", async () => {
    d.exec("DELETE FROM member_messages; DELETE FROM sms_pending");
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Thanks!", "app", null, { private: true, withId: 1 });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "You bet" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "You bet" });
  });

  it("treats a leader's text back to their own visit invitation as their reply to the presidency", async () => {
    const { notify, recipientById } = await import("@/lib/notify");
    // The leader is invited to a visit (e.g. a counselor, or testing on themselves) while others are waiting on them.
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Still need help?", "app", null, { private: true, withId: 1 });
    await notify([recipientById(1, 1)!], { title: "An invitation", body: "Hi Pres! We would love to visit Friday at 7.", url: "/visit-invite/1", textLink: "Reply here", asMember: true });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Friday works for us" })).toBe("saved");
    expect(conv.memberConversation(1, 1).at(-1)).toMatchObject({ direction: "in", body: "Friday works for us", recipient_id: null });
    expect(last(2)?.direction).toBe("in");
    // A leader's notice afterwards: replies are answers again.
    await notify([recipientById(1, 1)!], { title: "Reminder", body: "Lesson Sunday", url: "/lessons" });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "Yes, I'll call you" })).toBe("answer_sent");
    expect(last(2)).toMatchObject({ direction: "out", body: "Yes, I'll call you" });
  });
});

describe("a leader's texted reply about a visit answer", () => {
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

  it("sends a leader's text back about a visit answer to that member, not whoever wrote last", async () => {
    const pv = await import("@/lib/planned-visits");
    // Hyrum wrote earlier, and the leader answered him.
    await conv.receiveReply({ id: 2, org_id: 1, display_name: "Hyrum Johnson" }, "Can you help Saturday?", "app", null, { private: true, withId: 1 });
    await conv.sendAnswer({ id: 1, org_id: 1, display_name: "Pres Person" }, 2, "Got it", true);
    (await import("@/lib/db")).db().exec("UPDATE member_messages SET created_at = datetime('now', '-1 hour') WHERE member_id = 2");
    const plan = pv.savePlan({ orgId: 1, memberId: 4, date: "2030-10-16", time: "19:00", type: "home", note: "", requestId: null, visitors: [1], createdBy: 1 });
    await pv.sendInvitation(pv.getPlannedVisit(1, plan)!, "Hi Jane! We would love to visit.", 1);
    await pv.answerInvitation(pv.getPlannedVisit(1, plan)!, "new_time", "Wednesday between 6 and 7");
    // Her answer is in her conversation, under the invitation.
    expect(conv.conversation(1, 4, { private: false }).at(-1)).toMatchObject({ direction: "in", body: expect.stringContaining("Wednesday between 6 and 7") });
    expect(await lib.handleInboundText({ From: leaderPhone, Body: "We will plan on Wednesday at 6 PM" })).toBe("answer_sent");
    expect(conv.conversation(1, 4, { private: false }).at(-1)).toMatchObject({ direction: "out", body: "We will plan on Wednesday at 6 PM" });
    expect(conv.conversation(1, 2, { private: true, withId: 1 }).at(-1)?.body).toBe("Got it");
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
