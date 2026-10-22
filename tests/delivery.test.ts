import { beforeEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db, useTestDb } from "@/lib/db";
import { lastDelivery, messageReach, reachableBy, waysText } from "@/lib/delivery";
import { notify, recipientById } from "@/lib/notify";
import { sendToAudience } from "@/lib/groups";
import { collectDue } from "@/lib/scheduler";

describe("whether notifications reach people", () => {
  beforeEach(() => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'E', 'Emma Email', 'e@x.com', 'member'), (3, 1, 'N', 'Nora Nothing', NULL, 'member');
      UPDATE members SET welcomed_at = datetime('now');
    `);
  });

  it("keeps how each one was delivered, and who couldn't be reached", async () => {
    expect(reachableBy(2, 1)).toEqual(["email"]);
    expect(reachableBy(3, 1)).toEqual([]);
    await notify([recipientById(2, 1)!, recipientById(3, 1)!], { title: "Hi", body: "There", url: "/assignments/7?org=1" });
    expect(lastDelivery(2, "/assignments/7")?.delivered).toBe("email");
    expect(lastDelivery(3, "/assignments/7")?.delivered).toBe("");
    expect(lastDelivery(2, "/assignments/70")).toBeUndefined();
    expect(waysText("push,email")).toBe("app notification and email");
  });

  it("shows who a message reached and who opened it", async () => {
    const r = await sendToAudience({ orgId: 1, senderId: 1, audience: "everyone", title: "Open house", body: "Tickets", tz: "America/Boise" });
    db().prepare("UPDATE message_recipients SET read_at = datetime('now') WHERE member_id = 1").run();
    expect(messageReach(r.messageId)).toEqual({ total: 3, seen: 1, optedOut: [], unreached: ["Nora Nothing"], unseen: ["Emma Email"] });
  });

  it("re-sends an unanswered assignment request by email after 2 days, once", () => {
    db().prepare("INSERT INTO todos (id, org_id, title, assignee_id, created_by) VALUES (30, 1, 'Bring bread', 2, 1)").run();
    db().prepare("UPDATE todos SET accept_status = 'pending', asked_at = '2026-11-01 16:00:00' WHERE id = 30").run();
    const due = (t: string) => collectDue(DateTime.fromISO(t, { zone: "America/Boise" }).toUTC()).filter((n) => n.key.startsWith("todo-ask-again"));
    expect(due("2026-11-02T12:00")).toEqual([]);
    const [n] = due("2026-11-03T12:00");
    expect(n.only).toEqual(["email", "text"]);
    db().prepare("UPDATE todos SET accept_status = 'accepted' WHERE id = 30").run();
    expect(due("2026-11-03T12:00")).toEqual([]);
  });
});

describe("members who turned notifications off", () => {
  it("can't be reached when they turned off backups and have no app notifications, and opting out of an organization is reported", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'Q', 'Quiet Quinn', 'q@x.com', 'member'), (3, 1, 'O', 'Opted Olive', 'o@x.com', 'member');
      UPDATE members SET welcomed_at = datetime('now');
    `);
    expect(reachableBy(2, 1)).toEqual(["email"]);
    db().prepare("UPDATE members SET contact_pref = 'none' WHERE id = 2").run();
    expect(reachableBy(2, 1)).toEqual([]);
    db().prepare("UPDATE org_members SET notify = 0, official = 1 WHERE member_id = 3 AND org_id = 1").run();
    const r = await sendToAudience({ orgId: 1, senderId: 1, audience: "everyone", title: "Hi", body: "All", tz: "America/Boise" });
    const reach = messageReach(r.messageId);
    expect(reach.optedOut).toEqual(["Opted Olive"]);
    expect(reach.unreached).toEqual(["Quiet Quinn"]);
  });
});

describe("events that run for months", () => {
  it("are ongoing, with their span", async () => {
    const { isOngoing, spanText, ongoingText } = await import("@/lib/events");
    const e = { starts_at: "2027-03-01T17:00:00.000Z", ends_at: "2027-06-30T23:00:00.000Z" };
    expect(isOngoing(e)).toBe(true);
    expect(isOngoing({ starts_at: "2027-03-01T17:00:00.000Z", ends_at: "2027-03-01T19:00:00.000Z" })).toBe(false);
    expect(spanText(e, "America/Boise")).toBe("Mar 1 – Jun 30, 2027");
    expect(ongoingText(e, "America/Boise", DateTime.fromISO("2027-04-01T12:00:00Z"))).toBe("Now through Jun 30");
  });
});

describe("the presidency's Couldn't reach list", () => {
  it("lists direct sends that reached no one, once, and announcements as one item", async () => {
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'H', 'Hojo Johnson', 'h@x.com', 'member'), (3, 1, 'N', 'Nora', NULL, 'member');
      UPDATE members SET welcomed_at = datetime('now');
      UPDATE members SET contact_pref = 'none' WHERE id = 2;
    `);
    const { unreachedItems, unreachedCount, markUnreachedDone } = await import("@/lib/unreached");
    const ask = () => notify([recipientById(2, 1)!], { title: "Would you accept?", body: "x", url: "/assignments/9?org=1" }, { followUp: { what: "Assignment request: Bring bread" } });
    await ask();
    await ask(); // again: still one item
    await notify([recipientById(1, 1)!], { title: "Hi", body: "x", url: "/x" }, { followUp: { what: "Reaches email" } });
    expect(unreachedItems(1).map((u) => [u.name, u.what, u.why])).toEqual([["Hojo Johnson", "Assignment request: Bring bread", "they turned off email and text backups, and don't have app notifications on"]]);
    await sendToAudience({ orgId: 1, senderId: 1, audience: "everyone", title: "Open house", body: "Tickets", tz: "America/Boise" });
    const all = unreachedItems(1);
    expect(all[0]).toMatchObject({ member_id: null, what: "Message: Open house", detail: "Hojo Johnson, Nora" });
    expect(unreachedCount(1)).toBe(2);
    const { createSession, userForSession } = await import("@/lib/auth-core");
    const { adminCounts } = await import("@/lib/admin-counts");
    expect(adminCounts(userForSession(createSession(1, "month").id)!).unreached).toBe(2);
    expect(markUnreachedDone(1, all[0].id, 1)).toBe(true);
    expect(unreachedCount(1)).toBe(1);
    expect(unreachedItems(1, true)[0].done_by_name).toBe("Pres");
  });
});
