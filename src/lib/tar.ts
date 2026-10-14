/**
 * Minimal tar (ustar) files: enough to bundle the database and uploaded PDFs
 * into one backup download. Only plain files with short names.
 */
export interface TarEntry {
  name: string;
  data: Buffer;
}

function header(name: string, size: number, mtime: number): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, "utf8");
  h.write("0000644\0", 100);
  h.write("0000000\0", 108);
  h.write("0000000\0", 116);
  h.write(size.toString(8).padStart(11, "0") + "\0", 124);
  h.write(Math.floor(mtime).toString(8).padStart(11, "0") + "\0", 136);
  h.write("        ", 148);
  h.write("0", 156);
  h.write("ustar\0", 257);
  h.write("00", 263);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
}

export function packTar(entries: TarEntry[], mtime = Date.now() / 1000): Buffer {
  const parts: Buffer[] = [];
  for (const e of entries) {
    if (Buffer.byteLength(e.name) > 99) throw new Error(`name too long: ${e.name}`);
    parts.push(header(e.name, e.data.length, mtime), e.data);
    const pad = (512 - (e.data.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}

export function unpackTar(buf: Buffer): TarEntry[] {
  const out: TarEntry[] = [];
  let pos = 0;
  while (pos + 512 <= buf.length) {
    const h = buf.subarray(pos, pos + 512);
    if (h.every((b) => b === 0)) break;
    const name = h.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(h.subarray(124, 136).toString("ascii").replace(/\0.*$/s, "").trim() || "0", 8);
    const type = String.fromCharCode(h[156] || 48);
    if (!Number.isFinite(size) || size < 0 || pos + 512 + size > buf.length) throw new Error("damaged backup file");
    if (type === "0") out.push({ name, data: Buffer.from(buf.subarray(pos + 512, pos + 512 + size)) });
    pos += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
