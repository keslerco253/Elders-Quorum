import { MEETING_MINUTES } from "@/lib/reminder-settings";

/** A meeting's reminder and an optional second one (minutes before it starts). */
export function MeetingReminderFields({ id, first, second, className = "" }: { id: string; first: number; second: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <div>
        <label className="label" htmlFor={`${id}-reminder`}>
          Reminder
        </label>
        <select id={`${id}-reminder`} name="reminder" className="input" defaultValue={first}>
          {MEETING_MINUTES.map(([m, label]) => (
            <option key={m} value={m}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-reminder2`}>
          Second reminder
        </label>
        <select id={`${id}-reminder2`} name="reminder2" className="input" defaultValue={second}>
          {MEETING_MINUTES.map(([m, label]) => (
            <option key={m} value={m}>
              {m === 0 ? "None" : label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
