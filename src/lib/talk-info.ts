/** Pulls the title and speaker from a Gospel Library talk page. Best effort: returns blanks on failure. */
export async function fetchTalkInfo(url: string): Promise<{ title: string; speaker: string }> {
  try {
    const u = new URL(url);
    if (!/(^|\.)churchofjesuschrist\.org$/.test(u.hostname)) return { title: "", speaker: "" };
    const res = await fetch(u, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 (compatible; EldersQuorumApp)" } });
    if (!res.ok) return { title: "", speaker: "" };
    const html = await res.text();
    return parseTalkHtml(html);
  } catch {
    return { title: "", speaker: "" };
  }
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

export function parseTalkHtml(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const title = decode(og ?? titleTag ?? "").replace(/\s*[|–-]\s*The Church of Jesus Christ.*$/i, "");
  const author = html.match(/<p[^>]*class=["'][^"']*author-name[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
  const speaker = decode(author ?? "").replace(/^By\s+/i, "");
  return { title, speaker };
}
