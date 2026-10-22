import fs from "fs";
import path from "path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const FILE = path.join(process.cwd(), "docs", "PRESIDENCY-GUIDE.md");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The presidency guide (docs/PRESIDENCY-GUIDE.md) as a page, with a link to each section. */
export function leaderGuide(): { html: string; sections: { id: string; title: string }[] } | null {
  let md: string;
  try {
    md = fs.readFileSync(FILE, "utf8");
  } catch {
    return null;
  }
  // The file's own title is the page title.
  md = md.replace(/^# .*\n/, "");
  const sections: { id: string; title: string }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    if (depth !== 2) return `<h${depth}>${text}</h${depth}>`;
    const title = text
      .replace(/<[^>]+>/g, "")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
    const id = slug(title);
    sections.push({ id, title });
    return `<h2 id="${id}">${text}</h2>`;
  };
  const html = marked.parse(md, { async: false, gfm: true, renderer }) as string;
  return {
    html: sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2"]),
      allowedAttributes: { a: ["href", "title"], h2: ["id"] },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noreferrer" }) },
    }),
    sections,
  };
}

export interface GuideHit {
  /** The section it's in (to link to). */
  id: string;
  section: string;
  /** The paragraph or list item, as plain text. */
  text: string;
}

/** Plain text from a bit of the guide's Markdown. */
const plain = (md: string) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Searches the guide: every paragraph or list item (and heading) containing all the
 * words searched for, with the section it's in. Up to 40.
 */
export function searchGuide(query: string): GuideHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  let md: string;
  try {
    md = fs.readFileSync(FILE, "utf8");
  } catch {
    return [];
  }
  const hits: GuideHit[] = [];
  for (const part of md.split(/^(?=## )/m)) {
    const m = part.match(/^## (.+)$/m);
    if (!m) continue;
    const section = plain(m[1]);
    // Blocks: paragraphs, and each list item on its own.
    const blocks = part
      .replace(/^## .+$/m, "")
      .split(/\n\s*\n|\n(?=\s*[-*] |\s*\d+\. )/)
      .map(plain)
      .filter(Boolean);
    for (const text of [section, ...blocks]) {
      const lower = text.toLowerCase();
      if (words.every((w) => lower.includes(w))) hits.push({ id: slug(section), section, text });
      if (hits.length >= 40) return hits;
    }
  }
  return hits;
}
