import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-mlist-"));

describe("member list export", () => {
  it("writes a spreadsheet with callings, formatted phones, and safe quoting", async () => {
    const { memberListCsv } = await import("@/lib/member-list");
    const csv = memberListCsv(
      [
        { display_name: "Mark Johnson", role: "presidency", calling: "president", phone: "+12085550142", email: "mark@test.local" },
        { display_name: 'Smith, John "Jack"', role: "member", calling: null, phone: null, email: null },
      ] as never,
      { kind: "group", name: "Elders Quorum" },
      () => "",
    );
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Name,Calling,Phone,Email,Last signed in");
    expect(lines[1]).toBe("Mark Johnson,Elders Quorum President,(208) 555-0142,mark@test.local,");
    expect(lines[2]).toBe('"Smith, John ""Jack""",,,,');
  });
});

describe("members not in any organization", () => {
  it("lists ward members who haven't chosen an organization", async () => {
    const { useTestDb, db } = await import("@/lib/db");
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'Villas Ward', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'M', 'Mem', 'm@x.com', 'member');
    `);
    const { addToWard } = await import("@/lib/orgs");
    db().prepare("INSERT INTO members (id, name, display_name, email) VALUES (3, 'N', 'New Person', 'n@x.com')").run();
    addToWard(3, 1);
    const { orgMemberList } = await import("@/lib/member-list");
    const ward = (db().prepare("SELECT id FROM orgs WHERE ward_id = 1 AND kind = 'ward'").get() as { id: number }).id;
    expect(orgMemberList(ward, { show: "noorg" }).map((m) => m.display_name)).toEqual(["New Person"]);
  });
});
