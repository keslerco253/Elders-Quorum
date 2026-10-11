import { describe, expect, it } from "vitest";
import { displayNameFrom, guessMapping, parseCsv, planImport, toRows } from "@/lib/lcr-import";

const CSV = `﻿Name,Gender,Age,Birth Date,Address,Phone Number,E-mail
"Smith, John Adam",M,40,1 Jan 1986,"123 Main St
Boise, ID 83709",208-555-0101,JOHN@example.com
"Jones, Bob",M,33,2 Feb 1993,,208-555-0102,
,M,1,,,,
`;

describe("LCR import", () => {
  it("maps LCR headers", () => {
    const { headers } = parseCsv(CSV);
    expect(guessMapping(headers)).toEqual({ name: "Name", address: "Address", phone: "Phone Number", email: "E-mail" });
  });

  it("reads rows, flattens addresses and skips blank names", () => {
    const { headers, rows } = parseCsv(CSV);
    const res = toRows(rows, guessMapping(headers));
    expect(res.skipped).toBe(1);
    expect(res.rows[0]).toEqual({ name: "Smith, John Adam", displayName: "John Adam Smith", address: "123 Main St Boise, ID 83709", phone: "208-555-0101", email: "john@example.com" });
    expect(res.rows[1].email).toBeNull();
  });

  it("formats names", () => {
    expect(displayNameFrom("Smith, John")).toBe("John Smith");
    expect(displayNameFrom("Cher")).toBe("Cher");
  });

  it("plans creates, updates and missing members without erasing data", () => {
    const { headers, rows } = parseCsv(CSV);
    const { rows: r } = toRows(rows, guessMapping(headers));
    const plan = planImport(r, [
      { id: 1, name: "Jones, Bob", email: "bob@hand.com", phone: "208-555-0102", address: "9 Elm", status: "active", source: "import", role: "member" },
      { id: 2, name: "Gone, Moved", email: null, phone: null, address: null, status: "active", source: "import", role: "member" },
      { id: 3, name: "Bishop, Hand", email: null, phone: null, address: null, status: "active", source: "manual", role: "admin" },
    ]);
    expect(plan.creates.map((c) => c.name)).toEqual(["Smith, John Adam"]);
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(1);
    expect(plan.missing.map((m) => m.id)).toEqual([2]);
  });
});

import { parseTalkHtml } from "@/lib/talk-info";

describe("talk info", () => {
  it("reads the title and speaker from a talk page", () => {
    const html = `<html><head><title>Faith | The Church of Jesus Christ</title><meta property="og:title" content="Abide in My Love"></head>
      <body><p class="author-name" data-aid="1">By Elder D. Todd Christofferson</p></body></html>`;
    expect(parseTalkHtml(html)).toEqual({ title: "Abide in My Love", speaker: "Elder D. Todd Christofferson" });
  });
});
