"use client";

import { useEffect, useState } from "react";
import { patternOptions } from "@/lib/recurrence";

/**
 * "Repeats" for an event. The choices follow the date in the Starts field
 * (e.g. picking Friday Oct 16 offers "Every month on the third Friday").
 */
export function RepeatFields({
  initialStart,
  defaultPattern = "",
  defaultEnd = "never",
  defaultUntil = "",
  defaultCount = 12,
}: {
  initialStart: string;
  defaultPattern?: string;
  defaultEnd?: "never" | "until" | "count";
  defaultUntil?: string;
  defaultCount?: number;
}) {
  const [start, setStart] = useState(initialStart.slice(0, 10));
  const [pattern, setPattern] = useState(defaultPattern);
  const [end, setEnd] = useState(defaultEnd);

  // The event's first date, as the Starts or Date field says it (see EventTimeFields).
  useEffect(() => {
    const update = (e: Event) => setStart(String((e as CustomEvent<string>).detail).slice(0, 10));
    window.addEventListener("event-start-date", update);
    return () => window.removeEventListener("event-start-date", update);
  }, []);

  const options = patternOptions(start);
  // If the date changes so the chosen pattern no longer fits (e.g. "last Friday"), fall back to none.
  const value = options.some((o) => o.value === pattern) ? pattern : "";

  return (
    <div className="space-y-3 rounded-lg bg-surface-2 p-3">
      <div>
        <label className="label" htmlFor="repeat">
          Repeats
        </label>
        <select id="repeat" name="repeat" className="input" value={value} onChange={(e) => setPattern(e.target.value)}>
          <option value="">Does not repeat</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!start && <p className="hint">Choose the start date first to see the choices.</p>}
      </div>
      {value && (
        <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
          <div>
            <label className="label" htmlFor="repeat_end">
              Ends
            </label>
            <select id="repeat_end" name="repeat_end" className="input" value={end} onChange={(e) => setEnd(e.target.value as typeof end)}>
              <option value="never">Never</option>
              <option value="until">On a date</option>
              <option value="count">After a number of times</option>
            </select>
          </div>
          {end === "until" && <input aria-label="Last date" type="date" name="repeat_until" required min={start} defaultValue={defaultUntil} className="input" />}
          {end === "count" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="number" name="repeat_count" required min={2} max={200} defaultValue={defaultCount} className="input w-24" /> times
            </label>
          )}
          {end === "never" && <p className="hint sm:pb-2">Dates are added a year ahead and keep coming.</p>}
        </div>
      )}
    </div>
  );
}
