import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { saveTodo } from "@/app/(app)/admin/todos/actions";
import type { Todo } from "@/lib/assignments";

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
        <input name="due_date" type="date" className="input" defaultValue={todo?.due_date ?? ""} aria-label="Due date" />
      </div>
      <textarea name="notes" rows={3} className="input" placeholder="Details (optional): what's needed, who to talk to…" defaultValue={todo?.notes} />
      <div className="flex gap-2">
        <SubmitButton>{todo ? "Save" : "Add assignment"}</SubmitButton>
        {(todo || cancelHref) && (
          <Link href={cancelHref ?? back} className="btn-secondary">
            Cancel
          </Link>
        )}
      </div>
      <p className="hint">
        The person gets a notification, sees it under My assignments and on their home page, and is reminded the day before and the day it&apos;s due. They can add progress notes
        and mark it done.
      </p>
    </form>
  );
}
