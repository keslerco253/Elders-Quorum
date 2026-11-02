"use client";

import { useEffect } from "react";

/** The new meeting's date; the Repeats choices follow it (see RepeatFields). */
export function MeetingDateInput({ defaultValue, min }: { defaultValue: string; min: string }) {
  const tell = (v: string) => window.dispatchEvent(new CustomEvent("event-start-date", { detail: v }));
  useEffect(() => {
    tell(defaultValue);
  }, [defaultValue]);
  return <input name="date" type="date" required defaultValue={defaultValue} min={min} className="input" aria-label="Date" onChange={(e) => tell(e.target.value)} />;
}
