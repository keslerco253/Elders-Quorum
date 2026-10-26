"use client";

import { useEffect, useState } from "react";

/**
 * An event's Starts and Ends: dates and times, or with **All day** ticked just the
 * first and (optionally) last day. Both stay filled in when switching back and forth.
 */
export function EventTimeFields({ allDay: initialAllDay, start, end }: { allDay: boolean; start: string; end: string }) {
  const [allDay, setAllDay] = useState(initialAllDay);
  const [startAt, setStartAt] = useState(start);
  const [endAt, setEndAt] = useState(end);
  const [startDate, setStartDate] = useState(start.slice(0, 10));
  const [endDate, setEndDate] = useState(end.slice(0, 10) > start.slice(0, 10) ? end.slice(0, 10) : "");
  // Tells the Repeats choices which day it starts on.
  const firstDate = allDay ? startDate : startAt.slice(0, 10);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("event-start-date", { detail: firstDate }));
  }, [firstDate]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="all_day" checked={allDay} onChange={() => setAllDay(!allDay)} />
        <span className="font-medium">All day</span>
        <span className="text-muted">(no start time)</span>
      </label>
      {allDay ? (
        <>
          <div>
            <label className="label" htmlFor="start_date">
              Date
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              required
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setStartAt(`${e.target.value}${startAt.slice(10) || "T19:00"}`);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="end_date">
              Last day <span className="font-normal text-muted">(if more than one)</span>
            </label>
            <input id="end_date" name="end_date" type="date" min={startDate} className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="starts_at">
              Starts
            </label>
            <input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              required
              className="input"
              value={startAt}
              onChange={(e) => {
                setStartAt(e.target.value);
                setStartDate(e.target.value.slice(0, 10));
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="ends_at">
              Ends
            </label>
            <input id="ends_at" name="ends_at" type="datetime-local" required className="input" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
        </>
      )}
    </div>
  );
}
