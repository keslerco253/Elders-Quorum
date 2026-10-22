import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { ledOrgsAnywhere } from "@/lib/orgs";
import { leaderGuide, searchGuide } from "@/lib/guide";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Leader guide" };

/** How to use the app as a leader: for anyone in a presidency or bishopric. */
export default async function LeaderGuidePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const q = String((await searchParams).q ?? "").trim().slice(0, 100);
  if (!isAdmin(user) && ledOrgsAnywhere(user.id).length === 0) redirect("/");
  const guide = leaderGuide();
  const hits = q ? searchGuide(q) : [];
  return (
    <>
      <PageHeader title="Leader guide" back={{ href: "/admin", label: "Admin" }} subtitle="How to do everything in the app as a leader. Tap a topic to jump to it." />
      {!guide ? (
        <p className="text-sm text-muted">The guide isn&apos;t available right now.</p>
      ) : (
        <>
          <form action="/admin/guide" className="mb-4 flex gap-2" role="search">
            <input name="q" type="search" defaultValue={q} className="input min-w-0 flex-1" placeholder="Search the guide (e.g. reminders, assignment, texting)" aria-label="Search the guide" />
            <button className="btn-primary">Search</button>
          </form>
          {q && (
            <section className="card mb-6 text-sm" aria-label="Search results">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {hits.length ? `${hits.length}${hits.length === 40 ? "+" : ""} result${hits.length === 1 ? "" : "s"} for “${q}”` : `Nothing found for “${q}”. Try fewer or different words.`}
                </span>
                <a href="/admin/guide" className="link">
                  Clear
                </a>
              </div>
              <ul className="divide-y divide-border">
                {hits.map((h, i) => (
                  <li key={i} className="py-2">
                    <a href={`#${h.id}`} className="block hover:bg-surface-2">
                      <span className="block text-xs font-semibold text-accent">{h.section}</span>
                      <span className="text-muted">{highlight(h.text, q)}</span>
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
      )}
    </>
  );
}

/** The words searched for, marked in a result (shortened around the first one). */
function highlight(text: string, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const first = Math.max(0, text.toLowerCase().indexOf(words[0]));
  const start = text.length > 260 && first > 80 ? first - 60 : 0;
  const shown = (start ? "…" : "") + text.slice(start, start + 260) + (text.length > start + 260 ? "…" : "");
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return shown.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
