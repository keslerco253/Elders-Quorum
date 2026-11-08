import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { formatDateTime } from "@/lib/time";
import { suggestionCounts, suggestionsWith, SUGGESTION_STATUSES, type SuggestionStatus } from "@/lib/suggestions";
import { setSuggestionAction } from "./actions";

export const metadata = { title: "Suggestions" };

/**
 * Members' and leaders' ideas for the app, for the site owner: new ones first, then
 * those being worked on, done, or not being added. Moving one along can send the
 * person a note.
 */
export default async function SuggestionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  if (!user.is_site_owner) redirect("/");
  const sp = await searchParams;
  const view = (SUGGESTION_STATUSES.some(([k]) => k === sp.view) ? sp.view : "new") as SuggestionStatus;
  const counts = suggestionCounts();
  const list = suggestionsWith(view);
  const tz = user.ward.timezone;
  return (
    <>
      <PageHeader title="Suggestions" back={{ href: "/site", label: "Site owner" }} subtitle="Ideas for the app from members and leaders. Move each to Working on it, Done or Not adding; they're told, with your note." />
      <Flash msg={sp.msg} />
      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTION_STATUSES.map(([k, label]) => (
          <Link key={k} href={`/site/suggestions?view=${k}`} className={k === view ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
            {label} ({counts[k]})
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id} id={`s-${s.id}`} className="card scroll-mt-20 space-y-2 text-sm">
              <p className="whitespace-pre-wrap break-words">{s.body}</p>
              <div className="text-xs text-muted">
                {s.member_name ?? "Someone no longer in the app"}
                {s.org_name ? ` · ${s.org_name}` : ""} · {formatDateTime(s.created_at, tz, "LLL d, yyyy h:mm a")}
              </div>
              <form action={setSuggestionAction} className="space-y-2 border-t border-border pt-2">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="view" value={view} />
                <input name="note" maxLength={1000} defaultValue={s.owner_note} className="input text-sm" placeholder="Note back to them (optional), e.g. Thanks, coming next month" aria-label="Note back" />
                <div className="flex flex-wrap items-center gap-2">
                  {SUGGESTION_STATUSES.filter(([k]) => k !== s.status).map(([k, label]) => (
                    <SubmitButton key={k} name="status" value={k} className={k === "declined" ? "btn-secondary btn-sm" : "btn-primary btn-sm"} pendingText="…">
                      {label}
                    </SubmitButton>
                  ))}
                  <SubmitButton name="status" value={s.status} className="btn-secondary btn-sm" pendingText="…">
                    Save note
                  </SubmitButton>
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" name="tell" defaultChecked /> Let them know
                  </label>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
