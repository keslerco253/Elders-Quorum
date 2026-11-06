import Link from "next/link";
import { DateTime } from "luxon";
import { requirePresidency } from "@/lib/auth";
import { meetingName, searchMeetings, type MeetingSearchHit } from "@/lib/meetings";
import { formatDate } from "@/lib/time";
import { roleLabel } from "@/lib/types";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Search meetings" };

/** The words around the match, with the match itself marked. */
function Snippet({ text, q }: { text: string; q: string }) {
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return <>{text.length > 200 ? `${text.slice(0, 197)}…` : text}</>;
  const from = Math.max(0, at - 80);
  const to = Math.min(text.length, at + q.length + 120);
  return (
    <>
      {from > 0 && "…"}
      {text.slice(from, at)}
      <mark className="rounded bg-warn-soft px-0.5 text-text">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length, to)}
      {to < text.length && "…"}
    </>
  );
}

export default async function MeetingSearchPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePresidency();
  const q = String((await searchParams).q ?? "").trim().slice(0, 100);
  const hits = q ? searchMeetings(user.org_id, q) : [];
  // Grouped by meeting (the waiting agenda first), in the order found.
  const groups: { key: string; meeting: MeetingSearchHit["meeting"]; hits: MeetingSearchHit[] }[] = [];
  for (const h of hits) {
    const key = h.meeting ? `m${h.meeting.id}` : "next";
    const g = groups.find((x) => x.key === key);
    if (g) g.hits.push(h);
    else groups.push({ key, meeting: h.meeting, hits: [h] });
  }
  const timeText = (t: string | null) => (t ? ` · ${DateTime.fromFormat(t, "HH:mm").toFormat("h:mm a")}` : "");

  return (
    <>
      <PageHeader
        title="Search meetings"
        back={{ href: "/admin/meetings", label: "Meetings" }}
        subtitle={`Find a word or phrase anywhere in your ${roleLabel("presidency", user.org).toLowerCase()} meetings: agenda items and their notes, attached files' names, meeting notes, who was there, and assignments made.`}
      />
      <form className="mb-5 flex gap-2">
        <input name="q" type="search" defaultValue={q} autoFocus className="input" placeholder="A word or phrase…" aria-label="Search meetings" />
        <button className="btn-primary">Search</button>
      </form>
      {q.length === 1 && <p className="hint">Type at least two letters.</p>}
      {q.length >= 2 && (
        <p className="mb-3 text-sm text-muted">
          {hits.length === 0 ? `Nothing found for “${q}”.` : `${hits.length} place${hits.length === 1 ? "" : "s"} in ${groups.length} meeting${groups.length === 1 ? "" : "s"} mention “${q}”.`}
        </p>
      )}
      {q.length >= 2 && hits.length === 0 && <Empty>Try a shorter word, or part of a name.</Empty>}
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="h2 mb-2">
              {g.meeting ? (
                <Link href={`/admin/meetings/${g.meeting.id}`} className="hover:underline">
                  {meetingName(user.org_id, g.meeting)} · {formatDate(g.meeting.date, "short")}
                  {timeText(g.meeting.time)}
                </Link>
              ) : (
                <Link href="/admin/meetings#agenda" className="hover:underline">
                  Agenda for the next meeting
                </Link>
              )}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {g.hits.map((h, i) => (
                <li key={i}>
                  <Link href={h.href} className="block px-4 py-3 hover:bg-surface-2">
                    <span className="mb-0.5 block text-xs font-semibold tracking-wide text-accent uppercase">{h.where}</span>
                    <span className="block text-sm whitespace-pre-wrap break-words">
                      <Snippet text={h.text} q={q} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
