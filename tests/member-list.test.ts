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
