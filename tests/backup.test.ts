import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-backup-"));
process.env.DATA_DIR = dir;

describe("moving the app to another server", () => {
  it("packs and unpacks tar files", async () => {
    const { packTar, unpackTar } = await import("@/lib/tar");
    const files = [
      { name: "a.txt", data: Buffer.from("hello") },
      { name: "uploads/b.pdf", data: Buffer.alloc(1300, 7) },
      { name: "empty", data: Buffer.alloc(0) },
    ];
    expect(unpackTar(packTar(files))).toEqual(files);
  });

  it("restores a downloaded backup on a new server, with uploads", async () => {
    process.env.APP_URL = "https://old.example.ts.net";
    const { db } = await import("@/lib/db");
    db().exec(`
      INSERT INTO wards (id, name) VALUES (1, 'Villas');
      INSERT INTO members (id, ward_id, name, display_name, email, role, status) VALUES (1, 1, 'Pres', 'Pres', 'p@x', 'presidency', 'active');
      INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth, created_at) VALUES (1, 'https://push/old', 'k', 'a', '2026-01-01 00:00:00');
    `);
    fs.mkdirSync(path.join(dir, "uploads"), { recursive: true });
    const pdf = "0123456789abcdef01234567.pdf";
    fs.writeFileSync(path.join(dir, "uploads", pdf), "%PDF-1.4 test");
    const { makeBackup, restoreBackup } = await import("@/lib/backup-file");
    const backup = await makeBackup();

    // A brand-new server: empty data folder, new address.
    db().exec("DELETE FROM push_subscriptions; DELETE FROM members; DELETE FROM wards;");
    fs.rmSync(path.join(dir, "uploads"), { recursive: true });
    process.env.APP_URL = "https://app.mywardlink.net";

    expect(restoreBackup(Buffer.from("not a backup"))).toMatchObject({ ok: false });
    expect(restoreBackup(backup)).toEqual({ ok: true, wards: 1, members: 1, files: 1 });
    expect((db().prepare("SELECT name FROM members WHERE id = 1").get() as { name: string }).name).toBe("Pres");
    expect(fs.readFileSync(path.join(dir, "uploads", pdf), "utf8")).toBe("%PDF-1.4 test");

    // Pushes link to the new address; signing up again here replaces the old phone.
    const push = await import("@/lib/push");
    expect(push.withFullLinks({ title: "t", body: "b", url: "/lessons/3", actions: [{ action: "teach", title: "Yes", url: "/teach/3?t=x" }] })).toMatchObject({
      url: "https://app.mywardlink.net/lessons/3",
      actions: [{ url: "https://app.mywardlink.net/teach/3?t=x" }],
    });
    push.savePushSubscription(1, { endpoint: "https://push/new", keys: { p256dh: "k", auth: "a" } });
    expect(db().prepare("SELECT endpoint FROM push_subscriptions").all()).toEqual([{ endpoint: "https://push/new" }]);
  });
});
