import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Renders admin-written Markdown to safe HTML. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "img"]),
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noreferrer" }) },
  });
}
