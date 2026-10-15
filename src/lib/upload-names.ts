// Kinds of files people can attach (no database or server-only imports here,
// so backups and tests can use it too).

export const UPLOAD_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
} as const;
export type UploadExt = keyof typeof UPLOAD_TYPES;

/** Stored files are named <24 hex>.<kind>. */
export const UPLOAD_NAME = /^[a-f0-9]{24}\.(pdf|png|jpg|gif|webp|heic)$/;

/** For the file picker. */
export const UPLOAD_ACCEPT = "application/pdf,image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,.heic,.heif";

/** Pictures every browser can show on the page (HEIC opens as a file instead). */
export const isPicture = (name: string | null | undefined) => !!name && /\.(png|jpg|gif|webp)$/.test(name);

/** What a file really is, from its first bytes (not its name). */
export function sniffUpload(b: Buffer): UploadExt | null {
  const ascii = (from: number, to: number) => b.subarray(from, to).toString("latin1");
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  // iPhone photos: an ISO media file whose brand is HEIC/HEIF.
  if (ascii(4, 8) === "ftyp" && ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(ascii(8, 12))) return "heic";
  return null;
}
