import { requireUser } from "@/lib/auth";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { KeepDraft } from "@/components/keep-draft";
import { formatDateTime } from "@/lib/time";
import { mySuggestions, statusLabel } from "@/lib/suggestions";
import { suggestAction } from "./actions";

export const metadata = { title: "Suggest an improvement" };

const TONES = { new: "neutral", working: "info", done: "success", declined: "warn" } as const;

/** Anyone can suggest how the app could be better; it goes to the site owner, and they see what becomes of it. */
export default async function SuggestPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mine = mySuggestions(user.id);
  return (
    <>
      <PageHeader title="Suggest an improvement" back={{ href: "/more", label: "More" }} subtitle="An idea to make the app better, something confusing, or something you wish it did. It goes to the person who runs the app." />
      <Flash msg={sp.msg} />
      <form action={suggestAction} className="card max-w-xl space-y-3">
        <KeepDraft id="suggestion" addsTo="data-suggestion" />
        <textarea name="body" rows={5} maxLength={3000} required className="input" placeholder="e.g. It would help if lesson reminders said who's teaching." aria-label="Your idea" />
        <SubmitButton pendingText="Sending…">Send my idea</SubmitButton>
        <p className="hint">Your name goes with it, so you can be asked about it. To report a problem with your own account, ask your ward leaders.</p>
      </form>
      {mine.length > 0 && (
        <section className="mt-6 max-w-xl">
          <h2 className="h2 mb-2">Your ideas</h2>
          <ul className="space-y-2">
            {mine.map((s) => (
              <li key={s.id} data-suggestion={s.body} className="card space-y-1 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap break-words">{s.body}</p>
                  <Badge tone={TONES[s.status]}>{statusLabel(s.status)}</Badge>
                </div>
                {s.owner_note && <p className="rounded-lg bg-surface-2 px-3 py-2">{s.owner_note}</p>}
                <div className="text-xs text-muted">Sent {formatDateTime(s.created_at, user.ward.timezone, "LLL d, yyyy")}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
