"use client";

import { useState } from "react";

/** A personal event's start and end times, or All day (no times). */
export function PersonalTimeFields({ allDay: initial, start, end }: { allDay: boolean; start: string; end: string }) {
  const [allDay, setAllDay] = useState(initial);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="all_day" checked={allDay} onChange={() => setAllDay(!allDay)} />
        <span className="font-medium">All day</span>
        <span className="text-muted">(no start time)</span>
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="label">Starts</span>
            <input name="start_time" type="time" required className="input" defaultValue={start} />
          </label>
          <label className="text-sm">
            <span className="label">Ends (optional)</span>
            <input name="end_time" type="time" className="input" defaultValue={end} />
          </label>
        </div>
      )}
    </div>
  );
}
