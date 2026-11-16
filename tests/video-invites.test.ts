import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-video-"));

describe("video meeting invitations", () => {
  it("opens the link for the presidency, and for invited members for 12 hours only", async () => {
    const { useTestDb } = await import("@/lib/db");
    const d = useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'),
        (2, 1, 'A', 'Amy', 'a@x.com', 'member'),
        (3, 1, 'B', 'Bob', 'b@x.com', 'member');
    `);
    const m = await import("@/lib/meetings");
    const org = (d.prepare("SELECT org_id FROM org_members WHERE member_id = 1 AND role = 'presidency'").get() as { org_id: number }).org_id;
    m.setVideoLink(org, "https://us02web.zoom.us/j/123?pwd=abc");
    expect(m.videoLinkFor(org, 1)).toBe("https://us02web.zoom.us/j/123?pwd=abc");
    // Members can't open it until invited.
    expect(m.videoLinkFor(org, 2)).toBeNull();
    m.inviteToVideo(org, [2]);
    expect(m.videoLinkFor(org, 2)).toBe("https://us02web.zoom.us/j/123?pwd=abc");
    expect(m.videoLinkFor(org, 3)).toBeNull();
    // The invitation runs out.
    d.exec("UPDATE video_invites SET invited_at = datetime('now', '-13 hours')");
    expect(m.videoLinkFor(org, 2)).toBeNull();
    // Inviting again opens it again.
    m.inviteToVideo(org, [2]);
    expect(m.videoLinkFor(org, 2)).not.toBeNull();
  });
});
