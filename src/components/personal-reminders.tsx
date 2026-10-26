"use client";

import { useState } from "react";

type Reminder = { when: string; push: boolean; text: boolean; email: boolean };

/**
 * Reminders on a member's own to-do or calendar event: any number (up to `max`), each
 * some time before it, by any of app notification, email and (presidency members, up
 * to `maxTexts`) text. With none ticked it comes as an app notification.
 */
export function PersonalReminders({
  options,
  initial,
  canText,
  textReady,
  canEmail,
  max,
  maxTexts,
}: {
  options: [string, string][];
  initial: Reminder[];
  /** Presidency members may choose texts. */
  canText: boolean;
  /** They have a number that can get texts. */
  textReady: boolean;
  /** They have an email. */
  canEmail: boolean;
  max: number;
  maxTexts: number;
}) {
  const [list, setList] = useState(initial);
  const texts = list.filter((r) => r.text).length;
  const set = (i: number, patch: Partial<Reminder>) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused = options.find(([k]) => !list.some((r) => r.when === k))?.[0] ?? options[0][0];
  const way = (i: number, r: Reminder, key: "push" | "text" | "email", label: string, disabled = false) => (
    <label className={`flex items-center gap-1.5 text-sm ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" name={`${key}_${i}`} checked={r[key]} disabled={disabled} onChange={() => set(i, { [key]: !r[key] })} />
      {label}
    </label>
  );
  return (
    <fieldset className="space-y-3 rounded-lg bg-surface-2 p-3">
      <legend className="label">Reminders</legend>
      {list.length === 0 && <p className="text-sm text-muted">No reminders.</p>}
      {list.map((r, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <select
              name="when"
              value={r.when}
              onChange={(e) => set(i, { when: e.target.value })}
              className="input min-w-0 flex-1"
              data-native
              aria-label={`Reminder ${i + 1}: when`}
            >
              {options.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" className="rounded-lg px-2 py-1 text-muted hover:text-danger" aria-label={`Remove reminder ${i + 1}`} onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-1" role="group" aria-label={`Reminder ${i + 1}: how`}>
            {way(i, r, "push", "App")}
            {canEmail && way(i, r, "email", "Email")}
            {canText && way(i, r, "text", "Text", !textReady || (!r.text && texts >= maxTexts))}
          </div>
        </div>
      ))}
      {list.length < max && (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setList((l) => [...l, { when: unused, push: true, text: false, email: false }])}>
          + Add a reminder
        </button>
      )}
      <p className="hint mt-0">
        Tick how each one comes: <strong>App</strong> (a notification on your phone or computer)
        {canEmail ? ", Email" : ""}
        {canText ? `, or Text (up to ${maxTexts}; ${texts} used)` : ""}. With none ticked it comes as an app notification
        {canEmail ? ", or by email if notifications are off" : ""}.
        {canText && !textReady ? " To use texts, turn them on under More → Contact & notifications." : ""}
        {!canEmail ? " Add an email under More → Contact & notifications to get them by email." : ""}
      </p>
    </fieldset>
  );
}
