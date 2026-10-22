import { loadGuide, searchGuide, type GuideKind } from "@/lib/guide";
import { askConfigured, askGuide } from "@/lib/guide-ai";
import { renderMarkdown } from "@/lib/markdown";
import { allowHit } from "@/lib/rate-limit";

/**
 * A searchable guide (the leader guide, or the member Help guide): an Ask box that
 * answers from that guide (when it's set up), word matches, topics and the guide.
 */
export async function GuideView({ kind, q, userId, path, placeholder, asksPerHour }: { kind: GuideKind; q: string; userId: number; path: string; placeholder: string; asksPerHour: number }) {
  const guide = loadGuide(kind);
  // A question in their own words gets an answer from the guide (when it's set up); the word search shows too.
  const canAsk = askConfigured();
  const ask = q && canAsk ? (allowHit(`guide-ask:${kind}:${userId}`, asksPerHour, 60) ? await askGuide(q, kind) : null) : null;
  const words = q.replace(/[?.!,]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  const exact = q ? searchGuide(q, kind) : [];
  const hits = q ? (exact.length ? exact : searchGuide(words.slice(0, 3).join(" "), kind)) : [];
  if (!guide) return <p className="text-sm text-muted">The guide isn&apos;t available right now.</p>;
  return (
    <>
      <form action={path} className="mb-4 flex gap-2" role="search">
        <input
          name="q"
          type="search"
          defaultValue={q}
          className="input min-w-0 flex-1"
          placeholder={canAsk ? placeholder : "Search the guide"}
          aria-label={canAsk ? "Ask the guide" : "Search the guide"}
        />
        <button className="btn-primary">{canAsk ? "Ask" : "Search"}</button>
      </form>
      {ask && (
        <section className="card mb-4 overflow-hidden p-0" aria-label="Answer">
          <div className="border-b border-border bg-accent-soft px-4 py-3">
            <div className="text-xs font-semibold tracking-wide text-accent uppercase">Answer</div>
            <div className="font-semibold">{q}</div>
          </div>
          <div className="guide-answer prose-eq px-4 py-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(ask.answer) }} />
          {ask.sections.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <div className="mb-2 text-xs font-semibold text-muted">Read more in the guide</div>
              <div className="flex flex-wrap gap-2">
                {ask.sections.map((s) => (
                  <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-accent hover:bg-accent-soft">
                    {s.title} ↓
                  </a>
                ))}
              </div>
            </div>
          )}
          <p className="border-t border-border px-4 py-2 text-xs text-muted">Answered by AI from this guide. If something doesn&apos;t look right, check the part it points to.</p>
        </section>
      )}
      {q && canAsk && !ask && <p className="mb-4 text-sm text-muted">The question answerer isn&apos;t available right now, so here&apos;s what the guide says about those words.</p>}
      {q && (
        <section className="card mb-6 text-sm" aria-label="Search results">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold">
              {hits.length ? `${hits.length}${hits.length === 40 ? "+" : ""} place${hits.length === 1 ? "" : "s"} in the guide${ask ? " that mention it" : ` for “${q}”`}` : ask ? "No exact word matches." : `Nothing found for “${q}”. Try fewer or different words.`}
            </span>
            <a href={path} className="link">
              Clear
            </a>
          </div>
          <ul className="divide-y divide-border">
            {hits.map((h, i) => (
              <li key={i} className="py-2">
                <a href={`#${h.id}`} className="block hover:bg-surface-2">
                  <span className="block text-xs font-semibold text-accent">{h.section}</span>
                  <span className="text-muted">{highlight(h.text, exact.length ? q : words.slice(0, 3).join(" ") || q)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="card mb-6 text-sm" aria-label="Topics">
        <div className="mb-2 font-semibold">Topics</div>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {guide.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="link">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prose-eq guide max-w-3xl" dangerouslySetInnerHTML={{ __html: guide.html }} />
    </>
  );
}

/** Little words left out when a whole question is searched word by word. */
const STOP = new Set(["how", "the", "and", "for", "can", "what", "where", "when", "who", "does", "turn", "off", "app", "you", "our", "with", "this", "that", "want", "way", "make"]);

/** The words searched for, marked in a result (shortened around the first one). */
function highlight(text: string, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const first = Math.max(0, text.toLowerCase().indexOf(words[0]));
  const start = text.length > 260 && first > 80 ? first - 60 : 0;
  const shown = (start ? "…" : "") + text.slice(start, start + 260) + (text.length > start + 260 ? "…" : "");
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return shown.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
