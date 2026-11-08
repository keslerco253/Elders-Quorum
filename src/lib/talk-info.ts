/** Pulls the title and speaker from a Gospel Library talk page. Best effort: returns blanks on failure. */
export async function fetchTalkInfo(url: string): Promise<{ title: string; speaker: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { title: "", speaker: "" };
  }
  if (!/(^|\.)churchofjesuschrist\.org$/.test(u.hostname)) return { title: "", speaker: "" };
  // The Church's site sometimes turns away several requests at once or is slow: try again once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (compatible; MyWardLink)", "accept-language": "en" } });
      if (res.ok) {
        const info = parseTalkHtml(await res.text());
        if (info.title) return info;
      }
    } catch {
      // Try again.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { title: "", speaker: "" };
}

/**
 * A title from the link itself, for a talk whose page couldn't be read: "General
 * Conference talk, October 2025" (or "Talk"), so its Sunday shows it has a talk.
 */
export function fallbackTitle(url: string): string {
  const m = url.match(/general-conference\/(\d{4})\/(\d{2})\//);
  if (!m) return "Talk (open the link for the title)";
  const month = Number(m[2]) === 4 ? "April" : Number(m[2]) === 10 ? "October" : "";
  return `General Conference talk, ${month ? `${month} ` : ""}${m[1]}`;
}

/** Looks up several talks, two at a time (so the Church's site doesn't turn them away). */
export async function fetchTalkInfos(urls: string[]): Promise<{ title: string; speaker: string }[]> {
  const out: { title: string; speaker: string }[] = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      out[i] = await fetchTalkInfo(urls[i]);
    }
  };
  await Promise.all([worker(), worker()]);
  return out;
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
