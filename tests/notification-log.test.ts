import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-nlog-"));
process.env.DATA_DIR = dir;

describe("notifications list", () => {
  it("keeps every notification with its full text, and the link marks it read", async () => {
    const d = (await import("@/lib/db")).useTestDb("INSERT INTO wards (id, name) VALUES (1, 'W'); INSERT INTO members (id, ward_id, name, display_name, email) VALUES (1, 1, 'M', 'Mem', 'm@test.local');");
    const { notify, recipientById } = await import("@/lib/notify");
    const log = await import("@/lib/notification-log");
    const long = "A long message ".repeat(30).trim();
    await notify([recipientById(1, 1)!], { title: "Move Saturday", body: long, url: "/messages?re=3" });
    const [n] = log.notificationsFor(1);
    expect(n).toMatchObject({ title: "Move Saturday", body: long, url: "/messages?re=3", read_at: null });
    expect(log.unreadNotifications(1)).toBe(1);
    // The email's link carries ?n=<id> so opening it marks it read.
    const mail = fs.readFileSync(path.join(dir, "outbox", fs.readdirSync(path.join(dir, "outbox"))[0]), "utf8");
    expect(mail).toContain(`/messages?re=3&n=${n.id}`);
    log.markNotificationsRead(2, n.id); // someone else's id does nothing
    expect(log.unreadNotifications(1)).toBe(1);
    log.markNotificationsRead(1, n.id);
    expect(log.unreadNotifications(1)).toBe(0);
    // Messages are in Messages, not in Reminders & alerts.
    await notify([recipientById(1, 1)!], { title: "Pres", body: "Thanks for helping", url: "/messages/thread/all", message: true });
    expect(log.notificationsFor(1).map((x) => x.title)).toEqual(["Move Saturday"]);
    expect(log.unreadNotifications(1)).toBe(0);
  });
});
