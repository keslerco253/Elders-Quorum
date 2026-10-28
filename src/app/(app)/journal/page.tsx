import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { journalDay, longDate, validDate } from "@/lib/journal";
import { journalAccess } from "@/lib/journal-session";
import { formatDateTime, todayIn } from "@/lib/time";
import { Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { JournalEditor } from "./editor";
import { deleteJournalEntryAction, lockJournalAction } from "./actions";

export const metadata = { title: "My Journal" };

const PROMPTS = ["What happened today?", "What are you grateful for today?", "Where did you see the Lord's hand today?", "What did you learn today?", "Who did you help, or who helped you?"];

export default async function JournalPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const access = await journalAccess(user.id);
  if (!access) redirect(`/journal/unlock${sp.d ? `?next=${encodeURIComponent(`/journal?d=${sp.d}`)}` : ""}`);
  const tz = user.ward.timezone;
  const today = todayIn(tz);
  const asked = validDate(sp.d);
  const date = asked && asked <= today ? asked : today;
  const day = DateTime.fromISO(date);
  const prev = day.minus({ days: 1 }).toISODate()!;
  const next = day.plus({ days: 1 }).toISODate()!;
  const entries = journalDay(user.id, date, access.mk);

  return (
    <>
      <PageHeader
        title="My Journal"
        back={{ href: "/more", label: "More" }}
        actions={
          <>
            <Link href="/journal/all" className="btn-secondary btn-sm">
              📖 All entries
            </Link>
            <Link href="/journal/export" className="btn-secondary btn-sm">
              🖨️ Print / Export
            </Link>
          </>
        }
      />
      <Flash msg={sp.msg} />

      <div className="card mb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/journal?d=${prev}`} className="btn-secondary btn-sm" aria-label="The day before">
            ←
          </Link>
          <div className="text-center">
            <h2 className="h2">{longDate(date)}</h2>
            {date !== today && (
              <Link href="/journal" className="text-xs link">
                Back to today
              </Link>
            )}
          </div>
          {date < today ? (
            <Link href={`/journal?d=${next}`} className="btn-secondary btn-sm" aria-label="The day after">
              →
            </Link>
          ) : (
            <span className="btn-secondary btn-sm invisible" aria-hidden>
              →
            </span>
          )}
        </div>
        <form className="flex items-center justify-center gap-2 text-sm">
          <label htmlFor="d" className="text-muted">
            Go to a day
          </label>
          <input id="d" name="d" type="date" max={today} defaultValue={date} className="input w-auto py-1" />
          <button className="btn-secondary btn-sm">Go</button>
        </form>
      </div>

      <div className="space-y-5">
        {entries.map((e) => (
          <div key={e.id} id={`entry-${e.id}`} className="card scroll-mt-20 space-y-2">
            <JournalEditor owner={user.id} id={e.id} date={date} initial={e.body} time={formatDateTime(e.created_at, tz, "h:mm a")} />
            <form action={deleteJournalEntryAction} className="flex justify-end">
              <input type="hidden" name="entry_id" value={e.id} />
              <SubmitButton className="btn-secondary btn-sm" confirm="Delete this entry for good?" pendingText="Deleting…">
                Delete entry
              </SubmitButton>
            </form>
          </div>
        ))}
        <div className="card space-y-2">
          <div className="text-sm font-medium">{entries.length ? "Another entry" : "New entry"}</div>
          {/* Keyed by how many there are, so a fresh blank one appears after starting another. */}
          <JournalEditor owner={user.id} key={`new-${date}-${entries.length}`} date={date} placeholder={PROMPTS[day.ordinal % PROMPTS.length]} />
        </div>
      </div>

      <div className="hint mt-4 space-y-2">
        <p>🔒 Only you can see your journal. Your leaders can&apos;t, and it&apos;s stored encrypted. It saves as you type.</p>
        {access.mk ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Locked with your passcode.</span>
            <form action={lockJournalAction}>
              <SubmitButton className="link" pendingText="Locking…">
                Lock now
              </SubmitButton>
            </form>
            <Link href="/journal/passcode" className="link">
              Change or turn off passcode
            </Link>
          </div>
        ) : (
          <Link href="/journal/passcode" className="link">
            Add a passcode (optional)
          </Link>
        )}
      </div>
    </>
  );
}
