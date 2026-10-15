import { describe, expect, it } from "vitest";
import { isPicture, sniffUpload, UPLOAD_NAME } from "@/lib/upload-names";

const bytes = (...parts: (string | number[])[]) => Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))));

describe("attachments", () => {
  it("knows PDFs and pictures by their contents, not their names", () => {
    expect(sniffUpload(bytes("%PDF-1.7\n"))).toBe("pdf");
    expect(sniffUpload(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("png");
    expect(sniffUpload(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe("jpg");
    expect(sniffUpload(bytes("GIF89a......"))).toBe("gif");
    expect(sniffUpload(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))).toBe("webp");
    expect(sniffUpload(bytes([0, 0, 0, 0x18], "ftypheic", [0, 0, 0, 0]))).toBe("heic");
    // Anything else (including pictures as SVG, which can carry scripts) is refused.
    expect(sniffUpload(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffUpload(bytes("PK\u0003\u0004 a zip"))).toBeNull();
  });

  it("shows pictures on the page and serves only stored names", () => {
    expect(isPicture("0123456789abcdef01234567.jpg")).toBe(true);
    expect(isPicture("0123456789abcdef01234567.heic")).toBe(false);
    expect(isPicture("0123456789abcdef01234567.pdf")).toBe(false);
    expect(UPLOAD_NAME.test("0123456789abcdef01234567.webp")).toBe(true);
    expect(UPLOAD_NAME.test("../app.db")).toBe(false);
    expect(UPLOAD_NAME.test("0123456789abcdef01234567.svg")).toBe(false);
  });
});
