import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DateTime } from "luxon";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-routing-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

// A member's message goes to the leader it's for, not the whole presidency.
describe("who hears about a member's message", () => {
  let conv: typeof import("@/lib/conversations");
  let rn: typeof import("@/lib/reply-notify");
  let d: import("better-sqlite3").Database;
  const mailTo = (who: string) => (fs.existsSync(path.join(dir, "outbox")) ? fs.readdirSync(path.join(dir, "outbox")).filter((f) => f.includes(who)).length : 0);
  const member = (id: number) => ({ id, org_id: 1, display_name: `Member ${id}` });

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name) VALUES (1, 'Test Ward EQ');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role) VALUES
        (1, 1, 'Pres', 'Pres Person', 'pres@test.local', NULL, 'email', 'presidency'),
        (3, 1, 'Couns', 'Counselor Person', 'couns@test.local', NULL, 'email', 'presidency'),
        (2, 1, 'Mem', 'Member Two', 'mem2@test.local', NULL, 'email', 'member'),
        (4, 1, 'Mem', 'Member Four', 'mem4@test.local', NULL, 'email', 'member'),
        (5, 1, 'Mem', 'Member Five', 'mem5@test.local', NULL, 'email', 'member');
      INSERT INTO messages (id, ward_id, sender_id, audience, audience_label, title, body) VALUES (7, 1, 3, 'everyone', 'Everyone', 'Move Saturday', 'Who can help?');
      INSERT INTO message_recipients (message_id, member_id) VALUES (7, 2);
    `);
    d.exec("UPDATE org_members SET calling = 'president' WHERE org_id = 1 AND member_id = 1");
    d.exec("UPDATE org_members SET calling = 'counselor1' WHERE org_id = 1 AND member_id = 3");
    conv = await import("@/lib/conversations");
    rn = await import("@/lib/reply-notify");
  });

  it("tells only whoever sent what the member answered", async () => {
    await conv.receiveReply(member(2), "I can help", "app", 7);
    expect(mailTo("couns@")).toBe(1);
    expect(mailTo("pres@")).toBe(0);
    // Everyone still sees it in Messages.
    expect(conv.leaderInbox(1)[0]).toMatchObject({ member_name: "Member Two", unread: 1 });
  });

  it("folds a quick follow-up into the first notification", async () => {
    await conv.receiveReply(member(2), "Bringing my truck", "app", 7);
    expect(mailTo("couns@")).toBe(1);
  });

  it("sends a message with no clear sender to the message lead (the president unless chosen)", async () => {
    await conv.receiveReply(member(4), "Question about Sunday", "app", null);
    expect(mailTo("pres@")).toBe(1);
    d.exec("UPDATE orgs SET message_lead_id = 3 WHERE id = 1");
    expect(rn.messageLead(1)).toBe(3);
    await conv.receiveReply(member(5), "Another question", "app", null);
    expect(mailTo("couns@")).toBe(2);
    expect(mailTo("pres@")).toBe(1);
  });

  it("follows each leader's choice: every one, or none", () => {
    const leaders = [
      { id: 1, name: "Pres", email: "pres@test.local" },
      { id: 3, name: "Couns", email: "couns@test.local" },
    ] as unknown as import("@/lib/notify").Recipient[];
    d.exec("UPDATE org_members SET msg_notify = 'all' WHERE org_id = 1 AND member_id = 1");
    expect(rn.whoToNotify(1, 2, 7, leaders).map((r) => r.id).sort()).toEqual([1, 3]);
    d.exec("UPDATE org_members SET msg_notify = 'none' WHERE org_id = 1 AND member_id = 3");
    expect(rn.whoToNotify(1, 2, 7, leaders).map((r) => r.id)).toEqual([1]);
    d.exec("UPDATE org_members SET msg_notify = 'mine' WHERE org_id = 1");
  });

  it("\"I've got it\" takes it off the others' unread list until it's answered", async () => {
    rn.claimConversation(1, 2, 3);
    expect(conv.leaderInbox(1).find((r) => r.member_id === 2)).toMatchObject({ unread: 0, claimed_by: 3, claimed_by_name: "Counselor Person" });
    expect(conv.leaderInbox(3).find((r) => r.member_id === 2)!.unread).toBeGreaterThan(0);
    await conv.sendAnswer({ id: 3, org_id: 1, display_name: "Counselor Person" }, 2, "Thanks!", false);
    expect(rn.claimOf(1, 2)).toBeUndefined();
    expect(conv.leaderInbox(1).find((r) => r.member_id === 2)).toMatchObject({ unread: 0, claimed_by: null });
  });

  it("sends the evening summary only to leaders who turned it on", async () => {
    const { collectDue } = await import("@/lib/scheduler");
    const tz = (d.prepare("SELECT timezone FROM wards WHERE id = 1").get() as { timezone: string }).timezone;
    const at8 = DateTime.fromISO("2026-11-12T20:15", { zone: tz }).toUTC();
    const summaries = () => collectDue(at8).filter((n) => n.key.startsWith("msg-summary:"));
    expect(summaries()).toHaveLength(0);
    d.exec("UPDATE org_members SET msg_summary = 1 WHERE org_id = 1 AND member_id = 1");
    const due = summaries();
    expect(due).toHaveLength(1);
    expect(due[0].recipients.map((r) => r.id)).toEqual([1]);
    expect(due[0].payload.title).toContain("2 member messages waiting");
    expect(collectDue(at8.minus({ hours: 2 })).filter((n) => n.key.startsWith("msg-summary:"))).toHaveLength(0);
  });
});
