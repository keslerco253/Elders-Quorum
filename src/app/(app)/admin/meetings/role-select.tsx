"use client";

import { useRef } from "react";

/**
 * "Opening prayer: [who]": a presidency member chosen from a list, saved as soon as
 * it's picked (the meeting's record keeps the name).
 */
export function RoleSelect({
  action,
  meetingId,
  role,
  label,
  value,
  names,
  back,
}: {
  action: (fd: FormData) => Promise<void>;
  meetingId: number;
  role: string;
  label: string;
  value: string;
  names: string[];
  back?: "list";
}) {
  const form = useRef<HTMLFormElement>(null);
  // Someone no longer in the presidency stays shown on an older meeting.
  const options = value && !names.includes(value) ? [value, ...names] : names;
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="meeting_id" value={meetingId} />
      <input type="hidden" name="role" value={role} />
      {back && <input type="hidden" name="back" value={back} />}
      <label htmlFor={`${role}-${meetingId}`} className="w-36 shrink-0 text-sm font-medium">
        {label}
      </label>
      {/* Keyed by the saved name: the form is cleared after it saves, so it's drawn again with the new one. */}
      <select key={value} id={`${role}-${meetingId}`} name="name" defaultValue={value} className="input" onChange={() => form.current?.requestSubmit()}>
        <option value="">Not chosen</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <noscript>
        <button className="btn-secondary btn-sm">Save</button>
      </noscript>
    </form>
  );
}
