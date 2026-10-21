"use client";

import { useState } from "react";

/** "Send a notification" (when adding something) or "Send an update" (when changing it), and to whom. */
export function AnnounceField({ choices, label, about, hint }: { choices: { value: string; label: string }[]; label: string; about: string; hint?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="announce" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1" />
        <span>
          <strong>{label}</strong>
          <span className="block text-muted">{about}</span>
        </span>
      </label>
      {on && (
        <div className="ml-6">
          <label className="label" htmlFor="announce_to">
            Send it to
          </label>
          <select id="announce_to" name="announce_to" className="input" defaultValue={choices[0]?.value}>
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {hint && <p className="hint">{hint}</p>}
        </div>
      )}
    </div>
  );
}
