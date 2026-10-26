import Link from "next/link";
import { Linkify } from "@/components/linkify";
import { SubmitButton } from "@/components/client";
import type { AgendaItem } from "@/lib/meetings";
import { formatDateTime } from "@/lib/time";
import { moveAgenda, removeAgenda, saveItemNotes, toggleDiscussed } from "./actions";

const ARROWS = { top: "⤒", up: "↑", down: "↓" };
const LABELS = { top: "Move to the top", up: "Move up", down: "Move down" };

/**
 * Agenda items: who added them and from where. Tap one to change its wording or add
 * notes, ahead of time or in the meeting (notes taken in the meeting become its record
 * and count the item as discussed); tick off what was discussed. Everything saves in
 * place, so the page stays where it is.
 */
export function AgendaList({
  items,
  tz,
  meetingId,
  canEdit,
}: {
  items: AgendaItem[];
  tz: string;
  /** In a meeting (its page); otherwise the agenda waiting for the next one. */
  meetingId?: number;
  canEdit: boolean;
}) {
  const inMeeting = !!meetingId && canEdit;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((a, i) => {
        const about = (
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
        );
        const shown = (
          <>
            <div className="text-sm whitespace-pre-wrap break-words">
              <Linkify text={a.body} />
            </div>
            {a.notes && (
              <div className="mt-1 rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap break-words">
                <Linkify text={a.notes} />
              </div>
            )}
            {about}
          </>
        );
        const actions = (
          <div className="mt-2 flex flex-wrap gap-1">
            {/* Put the agenda in order: to the top, or ↑ / ↓ one place. */}
            {(["top", "up", "down"] as const).map((dir) =>
              (dir === "down" ? i < items.length - 1 : i > 0) ? (
                <form key={dir} action={moveAgenda}>
                  <input type="hidden" name="item_id" value={a.id} />
                  <input type="hidden" name="dir" value={dir} />
                  {meetingId && <input type="hidden" name="meeting_id" value={meetingId} />}
                  <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                    <span aria-label={LABELS[dir]} title={LABELS[dir]}>
                      {ARROWS[dir]}
                    </span>
                  </SubmitButton>
                </form>
              ) : (
                <span key={dir} className="btn-secondary btn-sm invisible" aria-hidden>
                  {ARROWS[dir]}
                </span>
              ),
            )}
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
        );
        return (
          <li key={a.id} id={`item-${a.id}`} className="flex scroll-mt-20 items-start gap-3 px-4 py-3">
            {inMeeting && (
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
              {canEdit ? (
                // Tap the item to change it or write notes.
                <details>
                  <summary className="cursor-pointer list-none">
                    {shown}
                    <span className="mt-1 inline-block text-xs font-medium text-accent">{a.notes ? "Edit" : inMeeting ? "+ Notes" : "Edit or add notes"}</span>
                  </summary>
                  {/* Keyed by what's saved: the form is cleared after saving and drawn again with it. */}
                  <form key={`${a.body}\n${a.notes}`} action={saveItemNotes} className="mt-2 space-y-2">
                    <input type="hidden" name="item_id" value={a.id} />
                    {meetingId ? <input type="hidden" name="meeting_id" value={meetingId} /> : <input type="hidden" name="beforehand" value="1" />}
                    <textarea name="body" rows={2} maxLength={2000} required defaultValue={a.body} className="input text-sm" aria-label="Agenda item" />
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={4000}
                      defaultValue={a.notes}
                      className="input text-sm"
                      placeholder={inMeeting ? "What was discussed or decided…" : "Notes to bring to the meeting…"}
                      aria-label="Notes"
                    />
                    <SubmitButton className="btn-secondary btn-sm" pendingText="Saving…">
                      Save
                    </SubmitButton>
                  </form>
                </details>
              ) : (
                shown
              )}
              {canEdit && actions}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
