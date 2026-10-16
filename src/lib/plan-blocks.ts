// A plan is a page of blocks: headings, text, pictures and PDFs, in order.
// Pictures and PDFs have a width (percent of the page) and a place (left or
// right with text flowing beside them, or centered). No server-only imports,
// so the editor can use these too.

import type { CSSProperties } from "react";
import { isPicture } from "./upload-names";

export type Align = "left" | "center" | "right";

/** Text and heading sizes. */
export type TextSize = "sm" | "md" | "lg" | "xl";
export const TEXT_SIZES: [TextSize, string][] = [
  ["sm", "Small"],
  ["md", "Normal"],
  ["lg", "Large"],
  ["xl", "Extra large"],
];
const textSize = (v: unknown): TextSize | undefined => (v === "sm" || v === "lg" || v === "xl" ? v : undefined);
/** The class for a block's size (none for Normal). */
export const sizeClass = (size?: TextSize) => (size && size !== "md" ? `plan-size-${size}` : "");

export type Block =
  | { id: string; type: "heading"; text: string; size?: TextSize }
  | { id: string; type: "text"; text: string; size?: TextSize }
  | { id: string; type: "image"; file: string; name: string; width: number; align: Align; caption: string }
  | { id: string; type: "pdf"; file: string; name: string; width: number; align: Align; caption: string; pages: boolean }
  | { id: string; type: "divider" };

export type MediaBlock = Extract<Block, { type: "image" | "pdf" }>;

export const MIN_WIDTH = 15;
export const newBlockId = () => Math.random().toString(36).slice(2, 10);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const width = (v: unknown, fallback = 100) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(MIN_WIDTH, n)) : fallback;
};
const align = (v: unknown): Align => (v === "left" || v === "right" ? v : "center");

/**
 * Reads blocks sent by the editor, keeping only well-formed ones. Files must
 * pass `fileOk` (uploaded to this ward).
 */
export function parseBlocks(json: string, fileOk: (name: string) => boolean): Block[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const b of raw.slice(0, 200)) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    const id = str(r.id, 20) || newBlockId();
    if (r.type === "heading") out.push({ id, type: "heading", text: str(r.text, 200), ...(textSize(r.size) ? { size: textSize(r.size) } : {}) });
    else if (r.type === "text") out.push({ id, type: "text", text: str(r.text, 20_000), ...(textSize(r.size) ? { size: textSize(r.size) } : {}) });
    else if (r.type === "divider") out.push({ id, type: "divider" });
    else if ((r.type === "image" || r.type === "pdf") && typeof r.file === "string" && fileOk(r.file)) {
      const base = { id, file: r.file, name: str(r.name, 200) || "Attachment", width: width(r.width), align: align(r.align), caption: str(r.caption, 300) };
      if (r.type === "image") out.push({ ...base, type: "image" });
      else out.push({ ...base, type: "pdf", pages: r.pages !== false });
    }
  }
  return out;
}

/** The blocks of a saved version. Versions from before the page builder become a picture or PDF and the text. */
export function versionBlocks(v: { blocks?: string | null; body: string; pdf_file: string | null; pdf_name: string | null }): Block[] {
  if (v.blocks) return parseBlocks(v.blocks, () => true);
  const out: Block[] = [];
  if (v.pdf_file) out.push(mediaBlock(v.pdf_file, v.pdf_name ?? "Attachment"));
  if (v.body.trim()) out.push({ id: "body", type: "text", text: v.body });
  return out;
}

/** A new block for an uploaded file: pictures show on the page, PDFs show their pages. */
export function mediaBlock(file: string, name: string): MediaBlock {
  const base = { id: newBlockId(), file, name, width: 100, align: "center" as Align, caption: "" };
  return file.endsWith(".pdf") || !isPicture(file) ? { ...base, type: "pdf", pages: file.endsWith(".pdf") } : { ...base, type: "image" };
}

/** Plain text of the page (kept with each version for anything that reads text). */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "heading" ? `## ${b.text}` : b.type === "text" ? b.text : b.type === "divider" ? "---" : b.caption))
    .filter((t) => t.trim())
    .join("\n\n");
}

export const blockFiles = (blocks: Block[]) => blocks.flatMap((b) => (b.type === "image" || b.type === "pdf" ? [b.file] : []));

/** Classes and width for a picture or PDF placed on the page (same in the editor and on the page). */
export function mediaProps(b: Pick<MediaBlock, "align" | "width">) {
  return {
    className: `plan-media plan-${b.align}${b.width > 45 ? " plan-wide" : ""}`,
    style: { "--w": `${b.width}%` } as CSSProperties,
  };
}
