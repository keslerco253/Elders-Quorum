// Kinds of files people can attach (no database or server-only imports here,
// so backups and tests can use it too).

export const UPLOAD_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  // Documents (attached to a meeting's agenda items; see sniffDocument).
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  // Sound and video (agenda items too): played on the page.
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
} as const;
export type UploadExt = keyof typeof UPLOAD_TYPES;

/** Stored files are named <24 hex>.<kind>. */
export const UPLOAD_NAME = /^[a-f0-9]{24}\.(pdf|png|jpg|gif|webp|heic|docx|xlsx|pptx|doc|xls|ppt|txt|csv|mp3|m4a|wav|mp4|mov)$/;

/** For the file picker. */
export const UPLOAD_ACCEPT = "application/pdf,image/png,image/jpeg,image/gif,image/webp,image/heic,image/heif,.heic,.heif";

/** For the file picker on an agenda item: PDFs, pictures, Office documents and plain text. */
export const DOCUMENT_ACCEPT = `${UPLOAD_ACCEPT},.docx,.xlsx,.pptx,.doc,.xls,.ppt,.txt,.csv,.mp3,.m4a,.wav,.mp4,.mov,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,video/mp4,video/quicktime`;

/** Files a browser can show or play itself (the rest are downloaded). */
export const opensInBrowser = (name: string) => /\.(pdf|png|jpg|gif|webp|mp3|m4a|wav|mp4|mov)$/.test(name);

/** Sound and video files, played on the page. */
export const isAudio = (name: string | null | undefined) => !!name && /\.(mp3|m4a|wav)$/i.test(name);
export const isVideo = (name: string | null | undefined) => !!name && /\.(mp4|mov)$/i.test(name);

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

/**
 * What an attached document is: a PDF or picture (by its first bytes), an Office file
 * whose contents match its name's extension (Word, Excel, PowerPoint, new or old), or
 * plain text / CSV (no binary bytes). Anything else is refused.
 */
export function sniffDocument(b: Buffer, fileName: string): UploadExt | null {
  const known = sniffUpload(b) ?? sniffMedia(b);
  if (known) return known;
  const ext = (fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "") as UploadExt;
  const zip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  const ole = b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (zip && ["docx", "xlsx", "pptx"].includes(ext)) return ext;
  if (ole && ["doc", "xls", "ppt"].includes(ext)) return ext;
  if (["txt", "csv"].includes(ext) && !b.subarray(0, 8192).includes(0)) return ext;
  return null;
}

/** Sound and video, from their first bytes: MP3, M4A, WAV, MP4 or a QuickTime movie. */
export function sniffMedia(b: Buffer): UploadExt | null {
  const ascii = (from: number, to: number) => b.subarray(from, to).toString("latin1");
  // MP3: an ID3 tag, or straight into an MPEG audio frame.
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return "mp3";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "M4A " || brand === "M4B ") return "m4a";
    if (brand === "qt  ") return "mov";
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "MSNV", "dash", "3gp4", "3gp5"].includes(brand)) return "mp4";
  }
  return null;
}
