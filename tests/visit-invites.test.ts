import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eq-invites-"));
process.env.DATA_DIR = dir;

describe("visit invitations", () => {
  let pv: typeof import("@/lib/planned-visits");
  let d: import("better-sqlite3").Database;
  const outbox = () => fs.readdirSync(path.join(dir, "outbox"));
  const read = (f: string) => fs.readFileSync(path.join(dir, "outbox", f), "utf8");

  beforeAll(async () => {
    d = (await import("@/lib/db")).useTestDb();
    d.exec(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES
        (1, 1, 'P', 'Daniel Carter', 'p@test.local', 'presidency'),
        (2, 1, 'C', 'Michael Nguyen', 'c@test.local', 'presidency'),
        (3, 1, 'M', 'Brother Sam Jones', 'm@test.local', 'member');
    `);
    pv = await import("@/lib/planned-visits");
  });

  it("writes a warm message with the date, time and who's coming", () => {
    expect(pv.inviteMessage("Sam", "2030-10-15", "19:00", ["Daniel Carter", "Michael Nguyen"])).toBe(
      "Hi Sam! We would love to come visit you and your family in your home on Tuesday, October 15 at 7:00 PM. Daniel Carter and Michael Nguyen from the elders quorum presidency are looking forward to seeing you. If that time doesn't work, please let us know a time that would be better for you.",
    );
    expect(pv.inviteMessage("Sam", "2030-10-15", null, ["Daniel Carter"])).toContain("Daniel Carter from the elders quorum presidency is looking forward");
  });

  it("sends the invitation and records each kind of answer", async () => {
    const id = pv.savePlan({ wardId: 1, memberId: 3, date: "2030-10-15", time: "19:00", type: "home", note: "", requestId: null, visitors: [1, 2], createdBy: 1 });
    await pv.sendInvitation(pv.getPlannedVisit(1, id)!, "Hi Sam! We would love to visit.", 1);
    const invite = read(outbox().find((f) => f.includes("m@test"))!);
    expect(invite).toContain("An invitation from the elders quorum presidency");
    expect(invite).toMatch(new RegExp(`/visit-invite/${id}\\?t=`));
    expect(pv.pendingInvitesFor(3, "2030-01-01").map((p) => p.id)).toEqual([id]);

    await pv.answerInvitation(pv.getPlannedVisit(1, id)!, "new_time", "Thursday after 6");
    expect(pv.getPlannedVisit(1, id)).toMatchObject({ invite_status: "new_time", member_reply: "Thursday after 6" });
    expect(read(outbox().filter((f) => f.includes("p@test")).pop()!)).toContain('asked for another time than Tue, Oct 15 at 7:00 PM: "Thursday after 6"');
    expect(pv.pendingInvitesFor(3, "2030-01-01")).toHaveLength(0);

    // A new time is sent; they accept.
    await pv.sendInvitation(pv.getPlannedVisit(1, id)!, "How about Thursday at 6:30?", 1);
    expect(pv.getPlannedVisit(1, id)).toMatchObject({ invite_status: "pending", member_reply: "" });
    await pv.answerInvitation(pv.getPlannedVisit(1, id)!, "accepted", "");
    expect(pv.getPlannedVisit(1, id)!.invite_status).toBe("accepted");
    expect(read(outbox().filter((f) => f.includes("c@test")).pop()!)).toContain("Brother Sam Jones said Tue, Oct 15 at 7:00 PM works.");
  });

  it("only opens with the member's own private link", () => {
    const t = pv.inviteToken(5, 3);
    expect(pv.validInviteToken(5, 3, t)).toBe(true);
    expect(pv.validInviteToken(5, 2, t)).toBe(false);
    expect(pv.validInviteToken(6, 3, t)).toBe(false);
  });
});
