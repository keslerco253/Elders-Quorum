import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { journalEntries } from "@/lib/journal";
import { formatDateTime } from "@/lib/time";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "All journal entries" };

export default async function JournalAllPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = String(sp.q || "").trim().slice(0, 100);
  const tz = user.ward.timezone;
  const entries = journalEntries(user.id, { q }).reverse();
  const months: { label: string; entries: typeof entries }[] = [];
  for (const e of entries) {
    const label = DateTime.fromISO(e.date).toFormat("LLLL yyyy");
    if (months.at(-1)?.label !== label) months.push({ label, entries: [] });
    months.at(-1)!.entries.push(e);
  }

  return (
    <>
      <PageHeader
        title="All entries"
        back={{ href: "/journal", label: "My Journal" }}
        actions={
          <Link href="/journal/export" className="btn-secondary btn-sm">
            🖨️ Print / Export
          </Link>
        }
      />
      <form className="mb-4 flex gap-2">
        <input name="q" type="search" defaultValue={q} placeholder="Search your journal" aria-label="Search your journal" className="input" />
        <button className="btn-secondary">Search</button>
      </form>
      {q && (
        <p className="hint mb-3">
          {entries.length === 1 ? "1 entry has" : `${entries.length} entries have`} &ldquo;{q}&rdquo;.{" "}
          <Link href="/journal/all" className="link">
            Show all
          </Link>
        </p>
      )}
      {entries.length === 0 && <Empty>{q ? "Nothing in your journal matches that." : "No entries yet. Write your first one under My Journal."}</Empty>}
      <div className="space-y-5">
        {months.map((m) => (
          <section key={m.label}>
            <h2 className="h2 mb-2">{m.label}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {m.entries.map((e) => (
                <li key={e.id}>
                  <Link href={`/journal?d=${e.date}#entry-${e.id}`} className="block px-4 py-3 hover:bg-surface-2">
                    <span className="block text-sm font-medium">
                      {DateTime.fromISO(e.date).toFormat("cccc, LLL d")} <span className="font-normal text-muted">· {formatDateTime(e.created_at, tz, "h:mm a")}</span>
                    </span>
                    <span className="line-clamp-2 text-sm text-muted">{e.body.trim()}</span>
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
