import Link from "next/link";
import { Linkify } from "@/components/linkify";
import { SubmitButton } from "@/components/client";
import type { AgendaItem } from "@/lib/meetings";
import { formatDateTime } from "@/lib/time";
import { removeAgenda, toggleDiscussed } from "./actions";

/** Agenda items: who added them and from where; in a meeting, tick off what was discussed. */
export function AgendaList({ items, tz, meetingId, canEdit }: { items: AgendaItem[]; tz: string; meetingId?: number; canEdit: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-3 px-4 py-3">
          {meetingId && canEdit && (
            <form action={toggleDiscussed}>
              <input type="hidden" name="item_id" value={a.id} />
              <input type="hidden" name="meeting_id" value={meetingId} />
              <input type="hidden" name="discussed" value={a.discussed ? "0" : "1"} />
              <button
                aria-label={a.discussed ? "Not discussed yet" : "Discussed"}
                title={a.discussed ? "Discussed (tap to undo)" : "Mark discussed"}
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border-2 ${a.discussed ? "border-success bg-success text-white" : "border-border hover:border-accent"}`}
              >
                {a.discussed ? "✓" : ""}
              </button>
            </form>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm whitespace-pre-wrap break-words">
              <Linkify text={a.body} />
            </div>
            <div className="mt-1 text-xs text-muted">
              {[a.source, a.adder && `added by ${a.adder}`, formatDateTime(a.created_at, tz, "LLL d")].filter(Boolean).join(" · ")}
              {a.link && (
                <>
                  {" · "}
                  <Link href={a.link} className="link">
                    Open
                  </Link>
                </>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              {meetingId && (
                <Link href={`/admin/meetings/${meetingId}?assign=${a.id}#assignment-form`} className="btn-secondary btn-sm" title="Make an assignment from this">
                  + Assignment
                </Link>
              )}
              <form action={removeAgenda}>
                <input type="hidden" name="item_id" value={a.id} />
                {meetingId && <input type="hidden" name="meeting_id" value={meetingId} />}
                <SubmitButton className="btn-secondary btn-sm" confirm="Take this off the agenda?" pendingText="…">
                  ✕
                </SubmitButton>
              </form>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
