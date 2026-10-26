"use client";

import { useState } from "react";

type Reminder = { when: string; text: boolean };

/**
 * A to-do's reminders: any number (up to `max`), each some time before it's due.
 * Presidency members can make up to `maxTexts` of them texts; the rest come as app
 * notifications.
 */
export function TodoReminders({
  options,
  initial,
  canText,
  textReady,
  max,
  maxTexts,
}: {
  options: [string, string][];
  initial: Reminder[];
  /** Presidency members may choose texts. */
  canText: boolean;
  /** They have a number that can get texts. */
  textReady: boolean;
  max: number;
  maxTexts: number;
}) {
  const [list, setList] = useState(initial);
  const texts = list.filter((r) => r.text).length;
  const set = (i: number, patch: Partial<Reminder>) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused = options.find(([k]) => !list.some((r) => r.when === k))?.[0] ?? options[0][0];
  return (
    <fieldset className="space-y-2 rounded-lg bg-surface-2 p-3">
      <legend className="label">Reminders</legend>
      {list.length === 0 && <p className="text-sm text-muted">No reminders.</p>}
      {list.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
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
          {canText && (
            <label className={`flex items-center gap-1.5 text-sm ${!textReady || (!r.text && texts >= maxTexts) ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                name={`text_${i}`}
                checked={r.text}
                disabled={!textReady || (!r.text && texts >= maxTexts)}
                onChange={() => set(i, { text: !r.text })}
              />
              Text
            </label>
          )}
          <button type="button" className="rounded-lg px-2 py-1 text-muted hover:text-danger" aria-label={`Remove reminder ${i + 1}`} onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      {list.length < max && (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setList((l) => [...l, { when: unused, text: false }])}>
          + Add a reminder
        </button>
      )}
      <p className="hint mt-0">
        {canText
          ? textReady
            ? `Up to ${maxTexts} can be texts (${texts} used); the rest come as app notifications.`
            : "To get some by text, turn on texts under More → Contact & notifications. Until then they come as app notifications."
          : "They come as app notifications (or by email if notifications are off)."}
      </p>
    </fieldset>
  );
}
