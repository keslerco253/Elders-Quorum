import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { SIGNUP_REMINDER_OPTIONS } from "@/lib/signups";
import type { PersonalTodo } from "@/lib/personal-todos";
import type { ReminderChannel } from "@/lib/reminder-prefs";
import { savePersonal } from "./actions";

const WAYS: Record<ReminderChannel, string> = { push: "App notification", email: "Email", text: "Text message" };

/** A member's own to-do: title, details, due date, two reminders and how they come. */
export function TodoForm({ todo, ways, hasEmail }: { todo?: PersonalTodo; ways: ReminderChannel[]; hasEmail: boolean }) {
  const chosen = (todo?.channels ?? "push").split(",");
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
      <input name="due_date" type="date" className="input" defaultValue={todo?.due_date ?? ""} aria-label="Due date" />
      <textarea name="notes" rows={3} className="input" placeholder="Details (optional)" defaultValue={todo?.notes} />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["reminder1_days", "reminder2_days"] as const).map((field, i) => (
          <div key={field}>
            <label className="label" htmlFor={field}>
              {i === 0 ? "Reminder" : "Second reminder"}
            </label>
            <select id={field} name={field} className="input" defaultValue={String((todo ? todo[field] : i === 0 ? 1 : 0) ?? "")}>
              {SIGNUP_REMINDER_OPTIONS.map(([v, label]) => (
                <option key={label} value={v ?? ""}>
                  {v === 0 ? "The morning it's due" : label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <fieldset>
        <legend className="label">Remind me by</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ways.map((w) => (
            <label key={w} className={`flex items-center gap-2 text-sm ${w === "email" && !hasEmail ? "opacity-50" : ""}`}>
              <input type="checkbox" name="channel" value={w} defaultChecked={chosen.includes(w)} disabled={w === "email" && !hasEmail} /> {WAYS[w]}
            </label>
          ))}
        </div>
        {!hasEmail && <p className="hint">To get them by email, add your email under More → Contact &amp; notifications.</p>}
      </fieldset>
      <div className="flex gap-2">
        <SubmitButton>{todo ? "Save" : "Add to-do"}</SubmitButton>
        <Link href="/assignments" className="btn-secondary">
          Cancel
        </Link>
      </div>
      <p className="hint">Reminders go out from 8 AM, when it has a due date, and only to you.</p>
    </form>
  );
}
