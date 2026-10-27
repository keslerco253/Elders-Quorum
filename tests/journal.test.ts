import { beforeEach, describe, expect, it } from "vitest";
import zlib from "zlib";
import { db, useTestDb } from "@/lib/db";
import { addJournalEntry, deleteJournalEntry, journalBookHtml, journalDay, journalDocx, journalEntries, journalRange, updateJournalEntry } from "@/lib/journal";

const SEED = `
    INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
    INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'A', 'Alma', 'a@x.com', 'member'), (2, 1, 'B', 'Bea', 'b@x.com', 'member');
`;

/** The files inside a zip, unpacked (enough to read back our own .docx). */
function unzip(buf: Buffer) {
  const out: Record<string, string> = {};
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const name = buf.toString("utf8", i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen;
    const data = zlib.inflateRawSync(buf.subarray(start, start + size));
    expect(zlib.crc32(data)).toBe(buf.readUInt32LE(i + 14));
    out[name] = data.toString("utf8");
    i = start + size;
  }
  return out;
}

describe("journal", () => {
  beforeEach(() => {
    useTestDb(SEED);
  });

  it("keeps several entries a day, only for their writer, stored encrypted", () => {
    const a = addJournalEntry(1, "2026-10-27", "Went to the temple <3");
    addJournalEntry(1, "2026-10-27", "Family night & games");
    addJournalEntry(2, "2026-10-27", "Bea's day");
    expect(journalDay(1, "2026-10-27").map((e) => e.body)).toEqual(["Went to the temple <3", "Family night & games"]);
    const raw = db().prepare("SELECT body FROM journal_entries WHERE id = ?").get(a) as { body: string };
    expect(raw.body).toMatch(/^v1:/);
    expect(raw.body).not.toContain("temple");

    expect(updateJournalEntry(2, a, "hijack")).toBe(false);
    deleteJournalEntry(2, a);
    expect(journalDay(1, "2026-10-27")).toHaveLength(2);
    expect(updateJournalEntry(1, a, "Went to the temple today")).toBe(true);
    expect(journalDay(1, "2026-10-27")[0].body).toBe("Went to the temple today");
  });

  it("finds entries by days and words, skipping blank ones", () => {
    addJournalEntry(1, "2025-12-31", "Last year");
    addJournalEntry(1, "2026-03-01", "Spring cleaning");
    addJournalEntry(1, "2026-03-02", "   ");
    expect(journalEntries(1).map((e) => e.date)).toEqual(["2025-12-31", "2026-03-01"]);
    expect(journalEntries(1, { q: "SPRING" }).map((e) => e.body)).toEqual(["Spring cleaning"]);
    const year = journalRange({ range: "year" }, "America/Boise");
    expect(year.from).toMatch(/^\d{4}-01-01$/);
    expect(journalRange({ range: "dates", from: "2026-03-05", to: "2026-03-01" }, "America/Boise")).toEqual({ range: "dates", from: "2026-03-05", to: "2026-03-05" });
    expect(journalEntries(1, { from: "2026-01-01", to: "2026-12-31" }).map((e) => e.body)).toEqual(["Spring cleaning"]);
  });

  it("prints and downloads as a Word document with each day and entry", () => {
    addJournalEntry(1, "2026-10-27", "Line one\nLine <two> & more");
    const book = { name: "Alma", entries: journalEntries(1), tz: "America/Boise", from: null, to: null };
    const page = journalBookHtml(book);
    expect(page).toContain("Alma's Journal");
    expect(page).toContain("Tuesday, October 27, 2026");
    expect(page).toContain("Line &lt;two&gt; &amp; more");
    const files = unzip(journalDocx(book));
    expect(Object.keys(files)).toEqual(["[Content_Types].xml", "_rels/.rels", "word/_rels/document.xml.rels", "word/styles.xml", "word/document.xml"]);
    expect(files["word/document.xml"]).toContain("Tuesday, October 27, 2026");
    expect(files["word/document.xml"]).toContain("Line &lt;two&gt; &amp; more");
    expect(files["word/document.xml"]).toContain('<w:pStyle w:val="Heading1"/>');
  });

  it("is deleted with the account", () => {
    addJournalEntry(1, "2026-10-27", "Mine");
    db().prepare("DELETE FROM members WHERE id = 1").run();
    expect(db().prepare("SELECT COUNT(*) AS n FROM journal_entries").get()).toEqual({ n: 0 });
  });
});
