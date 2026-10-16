import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-mflyer-"));
process.env.DATA_DIR = dir;
process.env.SMS_DEV_OUTBOX = "1";

describe("a group message with a flyer", () => {
  it("is saved with the flyer, emailed with it attached, and texted with a link", async () => {
    const d = (await import("@/lib/db")).useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, phone, contact_pref, role, sms_consent_at) VALUES
        (1, 1, 'P', 'Pres', 'p@test.local', NULL, 'email', 'presidency', NULL),
        (2, 1, 'E', 'Emma', 'emma@test.local', NULL, 'email', 'member', NULL),
        (3, 1, 'T', 'Tex', NULL, '+12085550123', 'text', 'member', datetime('now'));
    `);
    const { saveUpload } = await import("@/lib/uploads");
    const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
    const file = await saveUpload(new File([png], "Service project.png", { type: "image/png" }));
    const { sendToAudience } = await import("@/lib/groups");
    const r = await sendToAudience({ orgId: 1, senderId: 1, audience: "everyone", title: "Service Saturday", body: "Join us at 9.", tz: "America/Boise", flyer: { file, name: "Service project.png" } });
    expect(d.prepare("SELECT flyer_file, flyer_name FROM messages WHERE id = ?").get(r.messageId)).toEqual({ flyer_file: file, flyer_name: "Service project.png" });
    const out = fs.readdirSync(path.join(dir, "outbox"));
    const mail = fs.readFileSync(path.join(dir, "outbox", out.find((f) => f.includes("emma@test.local"))!), "utf8");
    expect(mail).toContain("Attachments: Service project.png");
    const sms = fs.readFileSync(path.join(dir, "outbox", out.find((f) => f.includes("sms-12085550123"))!), "utf8");
    expect(sms).toContain("Flyer attached; open the link to see it.");
    const { openAnnouncement } = await import("@/lib/member-inbox");
    expect(openAnnouncement(2, r.messageId)?.flyer_file).toBe(file);
  });
});
