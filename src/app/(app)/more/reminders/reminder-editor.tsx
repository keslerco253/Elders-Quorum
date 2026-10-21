"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/client";

type Channel = "push" | "text";
type Mode = "default" | "custom" | "off";

/** One area's reminder settings: as scheduled, my own (a list), or none. */
export function ReminderEditor({
  kind,
  title,
  scheduledText,
  options,
  starting,
  initial,
  canText,
  maxTexts,
  maxReminders,
  action,
}: {
  kind: string;
  title: string;
  scheduledText: string;
  options: [string, string][];
  starting: { when: string; channel: Channel }[];
  initial: { mode: Mode; reminders: { when: string; channel: Channel }[] };
  canText: boolean;
  maxTexts: number;
  maxReminders: number;
  action: (fd: FormData) => void;
}) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [list, setList] = useState(
    initial.reminders.length ? initial.reminders : starting,
  );
  const texts = list.filter((r) => r.channel === "text").length;
  const set = (i: number, patch: Partial<{ when: string; channel: Channel }>) =>
    setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused =
    options.find(([k]) => !list.some((r) => r.when === k))?.[0] ??
    options[0][0];

  return (
    <form action={action} id={kind} className="card scroll-mt-20 space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <h2 className="h2">{title}</h2>
      <div className="space-y-1.5 text-sm">
        {(
          [
            ["default", "As scheduled", scheduledText],
            [
              "custom",
              "My own reminders",
              "Choose when, and whether each comes as an app notification or a text.",
            ],
            ["off", "No reminders", ""],
          ] as const
        ).map(([value, label, about]) => (
          <label key={value} className="flex items-start gap-2">
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
              className="mt-1"
            />
            <span>
              <strong>{label}</strong>
              {about && <span className="block text-muted">{about}</span>}
            </span>
          </label>
        ))}
      </div>
      {mode === "custom" && (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
          {list.map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 border-b border-border pb-2 last-of-type:border-0 sm:border-0 sm:pb-0"
            >
              <select
                name="when"
                value={r.when}
                onChange={(e) => set(i, { when: e.target.value })}
                className="input min-w-0 basis-full sm:basis-0 sm:flex-1"
                data-native
                aria-label={`Reminder ${i + 1}: when`}
              >
                {options.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                name="channel"
                value={r.channel}
                onChange={(e) => set(i, { channel: e.target.value as Channel })}
                className="input min-w-0 flex-1 sm:w-auto sm:flex-none"
                data-native
                aria-label={`Reminder ${i + 1}: how`}
              >
                <option value="push">App notification</option>
                <option
                  value="text"
                  disabled={
                    !canText || (r.channel !== "text" && texts >= maxTexts)
                  }
                >
                  Text message
                </option>
              </select>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-muted hover:text-danger"
                aria-label={`Remove reminder ${i + 1}`}
                onClick={() => setList((l) => l.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          {list.length < maxReminders && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() =>
                setList((l) => [...l, { when: unused, channel: "push" }])
              }
            >
              + Add a reminder
            </button>
          )}
          <p className="hint mt-0">
            {canText
              ? `Up to ${maxTexts} can be texts (${texts} used); app notifications as many as you like.`
              : "To get reminders by text, turn on texts under More → Contact & notifications."}
          </p>
        </div>
      )}
      <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
    </form>
  );
}
