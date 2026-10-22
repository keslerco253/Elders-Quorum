import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { saveTodo } from "@/app/(app)/admin/todos/actions";
import type { Todo } from "@/lib/assignments";
import { SIGNUP_REMINDER_OPTIONS } from "@/lib/signups";
import { FlyerField } from "@/components/flyer-field";

/** New or edit assignment: to anyone in the organization, with a due date and details. */
export function AssignmentForm({
  todo,
  people,
  presidencyIds,
  back,
  meetingId,
  defaultTitle,
  defaultAssignee,
  cancelHref,
}: {
  todo?: Todo;
  people: { id: number; display_name: string }[];
  presidencyIds: number[];
  back: string;
  meetingId?: number;
  defaultTitle?: string;
  defaultAssignee?: number;
  cancelHref?: string;
}) {
  const presidency = people.filter((p) => presidencyIds.includes(p.id));
  const others = people.filter((p) => !presidencyIds.includes(p.id));
  return (
    <form action={saveTodo} className="card space-y-3" id="assignment-form">
      {todo && <input type="hidden" name="item_id" value={todo.id} />}
      {meetingId && <input type="hidden" name="meeting_id" value={meetingId} />}
      <input type="hidden" name="back" value={back} />
      <h2 className="h2">{todo ? "Edit assignment" : "New assignment"}</h2>
      <input name="title" required maxLength={200} className="input" placeholder="What needs to be done?" defaultValue={todo?.title ?? defaultTitle} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="assignee_id" className="input" defaultValue={todo?.assignee_id ?? defaultAssignee ?? ""} aria-label="Assigned to">
          <option value="">Unassigned</option>
          <optgroup label="Presidency">
            {presidency.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </optgroup>
          {others.length > 0 && (
            <optgroup label="Members">
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="flex gap-2">
          <input name="due_date" type="date" className="input min-w-0 flex-1" defaultValue={todo?.due_date ?? ""} aria-label="Due date" />
          <input name="due_time" type="time" className="input w-32" defaultValue={todo?.due_time ?? ""} aria-label="Time (optional)" title="Time (optional)" />
        </div>
      </div>
      <textarea name="notes" rows={3} className="input" placeholder="Details (optional): what's needed, who to talk to…" defaultValue={todo?.notes} />
      <FlyerField file={todo?.flyer_file} name={todo?.flyer_name} hint="Optional: a flyer, handout or picture (PDF or picture, up to 15 MB). It's on the assignment and sent with the request." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["reminder1_days", "reminder2_days"] as const).map((field, i) => (
          <div key={field}>
            <label className="label" htmlFor={`${field}-${todo?.id ?? "new"}`}>
              {i === 0 ? "Reminder" : "Second reminder"}
            </label>
            <select id={`${field}-${todo?.id ?? "new"}`} name={field} className="input" defaultValue={String((todo ? todo[field] : i === 0 ? 1 : 0) ?? "")}>
              {SIGNUP_REMINDER_OPTIONS.map(([v, label]) => (
                <option key={label} value={v ?? ""}>
                  {v === 0 ? "The morning it's due" : label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <SubmitButton>{todo ? "Save" : "Add assignment"}</SubmitButton>
        {(todo || cancelHref) && (
          <Link href={cancelHref ?? back} className="btn-secondary">
            Cancel
          </Link>
        )}
      </div>
      <p className="hint">
        Given to someone else, it&apos;s a request: they&apos;re asked &ldquo;Would you be willing to accept this assignment?&rdquo; and can accept or say they can&apos;t
        (with a note). Until they accept, it shows under Waiting on you as not accepted yet. Once accepted, it&apos;s on their home page and they get the reminders above (when it has a due date, at the hour set under Admin → Settings → Reminder times). Everything
        reaches them the way they chose under Contact &amp; notifications: app notification, plus email and/or text if they picked those. They can add progress notes and
        mark it done.
      </p>
    </form>
  );
}
