import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { MAX_TODO_REMINDERS, MAX_TODO_TEXTS, STARTING_TODO_REMINDERS, TODO_WHEN, todoReminders, type PersonalTodo } from "@/lib/personal-todos";
import { savePersonal } from "./actions";
import { PersonalReminders } from "@/components/personal-reminders";

/** A member's own to-do: title, details, due date and time, and its reminders. */
export function TodoForm({ todo, canText, textReady, canEmail }: { todo?: PersonalTodo; canText: boolean; textReady: boolean; canEmail: boolean }) {
  return (
    <form action={savePersonal} className="card max-w-xl space-y-3">
      {todo && <input type="hidden" name="item_id" value={todo.id} />}
      <p className="flex gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
        <span aria-hidden>🔒</span>
        <span>
          <strong>This to-do is entirely private.</strong> The only one who can see it is you. No one else can see it in the app: not your presidency, the
          bishopric, ward administrators or anyone else.
        </span>
      </p>
      <input name="title" required maxLength={200} className="input" placeholder="What do you want to get done?" defaultValue={todo?.title} />
      <div className="flex gap-2">
        <input name="due_date" type="date" className="input min-w-0 flex-1" defaultValue={todo?.due_date ?? ""} aria-label="Due date" />
        <input name="due_time" type="time" className="input w-36" defaultValue={todo?.due_time ?? ""} aria-label="Time (optional)" title="Time (optional)" />
      </div>
      <textarea name="notes" rows={3} className="input" placeholder="Details (optional)" defaultValue={todo?.notes} />
      <PersonalReminders
        options={TODO_WHEN}
        initial={todo ? todoReminders(todo) : STARTING_TODO_REMINDERS}
        canText={canText}
        textReady={textReady}
        canEmail={canEmail}
        max={MAX_TODO_REMINDERS}
        maxTexts={MAX_TODO_TEXTS}
      />
      <div className="flex gap-2">
        <SubmitButton>{todo ? "Save" : "Add to-do"}</SubmitButton>
        <Link href="/assignments" className="btn-secondary">
          Cancel
        </Link>
      </div>
      <p className="hint">Reminders go only to you, and only when it has a due date. Without a time, they count from 9 AM that day.</p>
    </form>
  );
}
