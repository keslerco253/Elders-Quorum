"use client";

import { useState } from "react";

/** "Send a notification" when saving something new, and to whom. */
export function AnnounceField({ choices, what }: { choices: { value: string; label: string }[]; what: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="announce" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1" />
        <span>
          <strong>Send a notification</strong>
          <span className="block text-muted">Lets people know about the {what} as soon as you save it.</span>
        </span>
      </label>
      {on && (
        <div className="ml-6">
          <label className="label" htmlFor="announce_to">
            Send it to
          </label>
          <select id="announce_to" name="announce_to" className="input" defaultValue="everyone">
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="hint">For a leaders-only event, only the leaders are notified.</p>
        </div>
      )}
    </div>
  );
}
