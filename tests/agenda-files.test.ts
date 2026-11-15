import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { sniffDocument } from "@/lib/upload-names";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "eq-agenda-files-"));

const file = (bytes: Buffer | string, name: string) => new File([new Uint8Array(typeof bytes === "string" ? Buffer.from(bytes) : bytes)], name);

describe("files on agenda items", () => {
  it("accepts PDFs, pictures, Office files and text, by their contents", () => {
    expect(sniffDocument(Buffer.from("%PDF-1.7 ..."), "x.bin")).toBe("pdf");
    expect(sniffDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "photo.jpeg")).toBe("jpg");
    expect(sniffDocument(Buffer.from("PK\x03\x04rest", "latin1"), "Budget.XLSX")).toBe("xlsx");
    expect(sniffDocument(Buffer.from("PK\x03\x04rest", "latin1"), "archive.zip")).toBeNull();
    expect(sniffDocument(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "old.doc")).toBe("doc");
    expect(sniffDocument(Buffer.from("name,phone\nA,1"), "list.csv")).toBe("csv");
    expect(sniffDocument(Buffer.from("MZ\x00\x00", "latin1"), "notes.txt")).toBeNull();
    expect(sniffDocument(Buffer.from("<script>"), "page.html")).toBeNull();
  });

  it("accepts sound and video (MP3, M4A, WAV, MP4, MOV) by their contents, not their names", () => {
    const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from(`ftyp${brand}`, "latin1"), Buffer.alloc(8)]);
    expect(sniffDocument(Buffer.from("ID3\x04\x00rest", "latin1"), "talk.mp3")).toBe("mp3");
    expect(sniffDocument(Buffer.from([0xff, 0xfb, 0x90, 0x64]), "no-tag.mp3")).toBe("mp3");
    expect(sniffDocument(ftyp("M4A "), "Voice memo.m4a")).toBe("m4a");
    expect(sniffDocument(Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ", "latin1"), "clip.wav")).toBe("wav");
    expect(sniffDocument(ftyp("isom"), "clip.mp4")).toBe("mp4");
    expect(sniffDocument(ftyp("mp42"), "renamed.bin")).toBe("mp4");
    expect(sniffDocument(ftyp("qt  "), "IMG_0001.MOV")).toBe("mov");
    // An iPhone photo is still a picture.
    expect(sniffDocument(ftyp("heic"), "IMG_0002.HEIC")).toBe("heic");
    expect(sniffDocument(Buffer.from("not really a song"), "fake.mp3")).toBeNull();
  });

  it("lets a sound or video clip be bigger than a document (40 MB, not 15)", async () => {
    const m = await import("@/lib/meetings");
    expect(m.MAX_AGENDA_MEDIA).toBeGreaterThan(m.MAX_AGENDA_FILE);
  });

  it("attaches, lists, serves only to that presidency, and removes them", async () => {
    const { useTestDb, db } = await import("@/lib/db");
    useTestDb(`
      INSERT INTO wards (id, name, timezone) VALUES (1, 'W', 'America/Boise');
      INSERT INTO members (id, ward_id, name, display_name, email, role) VALUES (1, 1, 'P', 'Pres', 'p@x.com', 'presidency'), (2, 1, 'M', 'Mem', 'm@x.com', 'member');
    `);
    const m = await import("@/lib/meetings");
    const item = m.addAgendaItem(1, "Budget", { addedBy: 1 });
    expect(await m.attachAgendaFiles(1, item, [file("%PDF-1.4 x", "Handout.pdf"), file("hello", "notes.txt")], 1)).toBeNull();
    expect(await m.attachAgendaFiles(1, item, [file("MZ", "virus.exe")], 1)).toMatch(/can't be attached/);
    const [a] = m.pendingAgenda(1);
    expect(a.files.map((f) => f.original_name)).toEqual(["Handout.pdf", "notes.txt"]);
    const stored = path.join(process.env.DATA_DIR!, "uploads", a.files[0].name);
    expect(fs.existsSync(stored)).toBe(true);
    // Removing it deletes the file.
    m.removeAgendaFile(1, a.files[0].id);
    expect(fs.existsSync(stored)).toBe(false);
    expect(m.pendingAgenda(1)[0].files).toHaveLength(1);
    // Who may open it: the presidency of that organization only.
    const { ledOrgIds } = await import("@/lib/conversations");
    const org = (db().prepare("SELECT org_id FROM agenda_files LIMIT 1").get() as { org_id: number }).org_id;
    expect(ledOrgIds(1)).toContain(org);
    expect(ledOrgIds(2)).not.toContain(org);
  });
});
