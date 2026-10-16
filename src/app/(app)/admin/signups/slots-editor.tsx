"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface Row {
  key: number;
  id?: number;
  label: string;
  capacity: number;
  /** How many have signed up (for slots that already existed). */
  taken: number;
  /** What's in the number box while typing (it may be blank for a moment). */
  typed?: string;
}

/** The slots of a service opportunity: a row for each, with a name and how many people are needed. */
export function SlotsEditor({ slots }: { slots: { id: number; label: string; capacity: number; taken: number }[] }) {
  const next = useRef(slots.length + 1);
  const [rows, setRows] = useState<Row[]>(() =>
    slots.length ? slots.map((s, i) => ({ key: i + 1, ...s })) : [{ key: 0, label: "", capacity: 1, taken: 0 }],
  );
  const list = useRef<HTMLDivElement>(null);
  const change = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => {
    const key = next.current++;
    setRows((rs) => [...rs, { key, label: "", capacity: 1, taken: 0 }]);
    focusKey.current = key;
  };
  // Put the cursor in a new row's name as soon as it's on the page.
  const focusKey = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (focusKey.current === null) return;
    list.current?.querySelector<HTMLInputElement>(`[data-key="${focusKey.current}"] input[type=text]`)?.focus();
    focusKey.current = null;
  }, [rows]);
  const remove = (r: Row) => {
    if (r.taken && !confirm(`${r.taken} ${r.taken === 1 ? "person has" : "people have"} signed up for "${r.label}". Remove the slot and their sign-ups when you save?`)) return;
    setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [{ key: next.current++, label: "", capacity: 1, taken: 0 }]));
  };

  return (
    <fieldset>
      <legend className="label">Slots</legend>
      <p className="hint mb-2 mt-0">The jobs, times or meals people can sign up for, and how many people each needs.</p>
      <div ref={list} className="space-y-2">
        <div className="hidden gap-2 px-1 text-xs font-medium text-muted sm:flex" aria-hidden="true">
          <span className="flex-1">Slot name</span>
          <span className="w-32 text-center">People needed</span>
          <span className="w-9" />
        </div>
        {rows.map((r, i) => (
          <div key={r.key} data-key={r.key} className="slot-row">
            <input type="hidden" name="slot_id" value={r.id ?? ""} />
            <input
              type="text"
              name="slot_label"
              className="input min-w-0 flex-1"
              value={r.label}
              maxLength={120}
              required={i === 0}
              placeholder={i === 0 ? "e.g. Volunteer, Bring a trailer, Monday dinner" : "Slot name"}
              aria-label={`Slot ${i + 1} name`}
              onChange={(e) => change(r.key, { label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (i === rows.length - 1) add();
                }
              }}
            />
            <span className="slot-count-label" aria-hidden="true">
              People needed
            </span>
            <div className="slot-count" role="group" aria-label={`People needed for slot ${i + 1}`}>
              <button type="button" aria-label="One fewer" disabled={r.capacity <= 1} onClick={() => change(r.key, { capacity: Math.max(1, r.capacity - 1), typed: undefined })}>
                −
              </button>
              <input
                type="number"
                name="slot_capacity"
                inputMode="numeric"
                min={1}
                max={500}
                value={r.typed ?? r.capacity}
                aria-label="People needed"
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  change(r.key, { typed: e.target.value, ...(n >= 1 ? { capacity: Math.min(500, n) } : {}) });
                }}
                onBlur={() => change(r.key, { typed: undefined })}
              />
              <button type="button" aria-label="One more" disabled={r.capacity >= 500} onClick={() => change(r.key, { capacity: Math.min(500, r.capacity + 1), typed: undefined })}>
                +
              </button>
            </div>
            <button type="button" className="slot-remove" aria-label={`Remove slot ${i + 1}`} title="Remove this slot" onClick={() => remove(r)}>
              ✕
            </button>
            {r.taken > 0 && (
              <div className="slot-taken">
                {r.taken} signed up{r.capacity < r.taken && " (more than needed)"}
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary mt-2" onClick={add}>
        + Add a slot
      </button>
    </fieldset>
  );
}
