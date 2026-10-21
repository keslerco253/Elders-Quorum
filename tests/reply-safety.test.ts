import { beforeAll, describe, expect, it } from "vitest";

describe("members' replies always reach someone", () => {
  let d: import("better-sqlite3").Database;
  let inbound: typeof import("@/lib/sms-inbound");
  let routing: typeof import("@/lib/message-routing");
  let orgs: typeof import("@/lib/orgs");
  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, role) VALUES
        (1, 1, 'P', 'Pres Elder', 'p@t.l', '+12085550001', 'presidency'),
        (2, 1, 'R', 'Rose President', 'r@t.l', '+12085550002', 'member'),
        (3, 1, 'M', 'Mary Member', 'm@t.l', '+12085550003', 'member'),
        (4, 1, 'B', 'Ben Backup', 'b@t.l', '+12085550004', 'member');
    `);
    // 1 = Elders Quorum (Pres Elder leads it), 3 = Relief Society (Rose), 5 = Young Women (nobody leads it).
    d.exec(`UPDATE orgs SET active = 1 WHERE id IN (3, 5);
      INSERT OR REPLACE INTO org_members (org_id, member_id, role) VALUES (3, 2, 'presidency'), (3, 3, 'member'), (5, 3, 'member');
      UPDATE members SET welcomed_at = datetime('now');`);
    inbound = await import("@/lib/sms-inbound");
    routing = await import("@/lib/message-routing");
    orgs = await import("@/lib/orgs");
  });
  const text = async (from: string, body: string) => {
    const out: { reply?: string } = {};
    const result = await inbound.handleInboundText({ From: from, Body: body }, out);
    return { result, reply: out.reply };
  };
  const lastIn = () => d.prepare("SELECT org_id, body, needs_home, note FROM member_messages WHERE direction = 'in' ORDER BY id DESC LIMIT 1").get() as { org_id: number; body: string; needs_home: number; note: string | null };
  const notified = (memberId: number) => d.prepare("SELECT title, body FROM notification_log WHERE member_id = ? ORDER BY id DESC LIMIT 1").get(memberId) as { title: string; body: string } | undefined;

  it("asks which organization a reply is for when two texted lately, and delivers it there", async () => {
    d.exec(`UPDATE members SET last_text_org_id = 1 WHERE id = 3;
      INSERT INTO member_text_orgs (member_id, org_id, at) VALUES (3, 1, datetime('now', '-1 hour')), (3, 3, datetime('now', '-1 day'));`);
    const ask = await text("+12085550003", "I can bring a salad");
    expect(ask.result).toBe("asked_which");
    expect(ask.reply).toBe("Which is your message for? Reply 1 for Elders Quorum or 2 for Relief Society.");
    expect(await text("+12085550003", "2")).toMatchObject({ result: "saved" });
    expect(lastIn()).toMatchObject({ org_id: 3, body: "I can bring a salad", needs_home: 0 });
    expect(notified(2)?.title).toBe("Reply from Mary Member");
  });

  it("delivers a held reply to whoever texted last if there's no answer", async () => {
    d.prepare("INSERT INTO sms_member_pending (member_id, body, options, created_at) VALUES (3, 'See you there', '[1,3]', datetime('now', '-40 minutes'))").run();
    await inbound.deliverHeldReplies();
    expect(lastIn()).toMatchObject({ org_id: 1, body: "See you there" });
    expect(d.prepare("SELECT COUNT(*) AS n FROM sms_member_pending").get()).toEqual({ n: 0 });
  });

  it("sends a reply nobody can receive to the ward's backup person, who can forward it", async () => {
    d.exec(`DELETE FROM member_text_orgs; UPDATE members SET last_text_org_id = 5 WHERE id = 3; UPDATE wards SET reply_backup_id = 4 WHERE id = 1;`);
    expect((await text("+12085550003", "Is the activity still on?")).result).toBe("saved");
    expect(lastIn()).toMatchObject({ org_id: 5, needs_home: 1 });
    expect(notified(4)?.title).toBe("A message needs passing on");
    expect(routing.messagesNeedingHome(1)).toHaveLength(1);

    const ben = orgs.currentUserFor(d.prepare("SELECT * FROM members WHERE id = 4").get() as never, 1)!;
    expect(routing.handlesBackup(ben)).toBe(true);
    const id = routing.messagesNeedingHome(1)[0].id;
    expect(await routing.forwardMessage(ben, id, "org:3")).toBe("the Relief Society presidency");
    expect(lastIn()).toMatchObject({ org_id: 3, body: "Is the activity still on?", note: "Forwarded by Ben Backup from Young Women" });
    expect(routing.messagesNeedingHome(1)).toHaveLength(0);
    expect(notified(2)?.title).toBe("Forwarded: message from Mary Member");
    // Her next texted reply goes there.
    expect((d.prepare("SELECT last_text_org_id FROM members WHERE id = 3").get() as { last_text_org_id: number }).last_text_org_id).toBe(3);
  });

  it("only lets that organization's leaders, the backup or the bishopric forward", async () => {
    const mary = orgs.currentUserFor(d.prepare("SELECT * FROM members WHERE id = 3").get() as never, 3)!;
    const id = (d.prepare("SELECT id FROM member_messages WHERE direction = 'in' ORDER BY id DESC LIMIT 1").get() as { id: number }).id;
    expect(await routing.forwardMessage(mary, id, "org:1")).toBeNull();
  });

  it("tells a number that isn't in the app, once a month", async () => {
    expect(await text("+12085559999", "Hi, is this the ward?")).toEqual({ result: "unknown_sender", reply: inbound.UNKNOWN_NUMBER_REPLY });
    expect(await text("+12085559999", "Hello?")).toEqual({ result: "unknown_sender", reply: undefined });
  });
});
