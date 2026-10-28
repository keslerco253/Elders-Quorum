import { describe, expect, it } from "vitest";

describe("No reply needed", () => {
  it("takes Needs reply off a conversation until the member writes again", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'),
        (5, 1, 'M', 'Mary', 'm@x.com', 'member');
    `);
    const c = await import("@/lib/conversations");
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    const write = (body: string) => d.prepare("INSERT INTO member_messages (org_id, member_id, direction, body) VALUES (?, 5, 'in', ?)").run(org, body);
    const needs = () => c.leaderInbox(1).find((r) => r.member_id === 5)!.needs_reply;
    write("Thanks!");
    expect(needs()).toBe(1);
    c.markNoReplyNeeded(org, 5, { private: false }, 1);
    expect(needs()).toBe(0);
    // Read for the leader who marked it.
    expect(c.leaderInbox(1).find((r) => r.member_id === 5)!.unread).toBe(0);
    c.markNoReplyNeeded(org, 5, { private: false }, 1, false);
    expect(needs()).toBe(1);
    c.markNoReplyNeeded(org, 5, { private: false }, 1);
    write("One more thing…");
    expect(needs()).toBe(1);
  });
});
