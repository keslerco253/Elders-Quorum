"use client";

import { useEffect, useRef, useState } from "react";

const KEEP = "mwl-role-notify";

/**
 * "Opening prayer: [who]": someone chosen from a list, saved as soon as it's picked.
 * It's an assignment on their list; they're notified when the box made with
 * RoleNotifyBox (same `notifyBox` id) is ticked.
 */
export function RoleSelect({
  action,
  meetingId,
  role,
  label,
  value,
  people,
  notifyBox,
  back,
}: {
  action: (fd: FormData) => Promise<void>;
  meetingId: number;
  role: string;
  label: string;
  /** The name shown on the meeting now. */
  value: string;
  people: { id: number; name: string }[];
  notifyBox: string;
  back?: "list";
}) {
  const form = useRef<HTMLFormElement>(null);
  const notify = useRef<HTMLInputElement>(null);
  const current = people.find((p) => p.name === value);
  // Someone no longer in the list (or a name from before) stays shown on an older meeting.
  const selected = current ? String(current.id) : value ? `name:${value}` : "";
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="meeting_id" value={meetingId} />
      <input type="hidden" name="role" value={role} />
      <input ref={notify} type="hidden" name="notify" value="1" />
      {back && <input type="hidden" name="back" value={back} />}
      <label htmlFor={`${role}-${meetingId}`} className="w-36 shrink-0 text-sm font-medium">
        {label}
      </label>
      {/* Keyed by the saved name: the form is cleared after it saves, so it's drawn again with the new one. */}
      <select
        key={value}
        id={`${role}-${meetingId}`}
        name="member_id"
        defaultValue={selected}
        className="input"
        onChange={() => {
          const box = document.getElementById(notifyBox) as HTMLInputElement | null;
          if (notify.current) notify.current.value = box && !box.checked ? "0" : "1";
          form.current?.requestSubmit();
        }}
      >
        <option value="">Not chosen</option>
        {!current && value && <option value={`name:${value}`}>{value}</option>}
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <noscript>
        <button className="btn-secondary btn-sm">Save</button>
      </noscript>
    </form>
  );
}

/** "Notify the person chosen": ticked unless this leader last chose otherwise (kept on this device). */
export function RoleNotifyBox({ id }: { id: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEEP) === "0") setOn(false);
    } catch {
      // No storage: ticked.
    }
  }, []);
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="mt-1"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          try {
            localStorage.setItem(KEEP, e.target.checked ? "1" : "0");
          } catch {
            // Not kept.
          }
        }}
      />
      <span>
        Notify the person chosen
        <span className="block text-xs text-muted">Either way it goes on their assignments, where they can ask someone else to take it.</span>
      </span>
    </label>
  );
}
