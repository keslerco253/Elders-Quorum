"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/client";

type Channel = "push" | "text" | "email";
type Reminder = { when: string; channels: Channel[] };
const WAYS: [Channel, string][] = [
  ["push", "App"],
  ["text", "Text"],
  ["email", "Email"],
];
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
  canEmail,
  maxTexts,
  maxReminders,
  action,
}: {
  kind: string;
  title: string;
  scheduledText: string;
  options: [string, string][];
  starting: Reminder[];
  initial: { mode: Mode; reminders: Reminder[] };
  canText: boolean;
  canEmail: boolean;
  maxTexts: number;
  maxReminders: number;
  action: (fd: FormData) => void;
}) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [list, setList] = useState(
    initial.reminders.length ? initial.reminders : starting,
  );
  const texts = list.filter((r) => r.channels.includes("text")).length;
  const set = (i: number, patch: Partial<Reminder>) =>
    setList((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // Tick or untick one way; at least one stays ticked.
  const toggle = (i: number, c: Channel) =>
    setList((l) =>
      l.map((r, j) => {
        if (j !== i) return r;
        const channels = r.channels.includes(c) ? r.channels.filter((x) => x !== c) : [...r.channels, c];
        return channels.length ? { ...r, channels } : r;
      }),
    );
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
              "Choose when, and how each one comes: app notification, text, email, or any of them.",
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
              <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 sm:flex-none" role="group" aria-label={`Reminder ${i + 1}: how`}>
                {WAYS.map(([c, label]) => {
                  const off = (c === "text" && (!canText || (!r.channels.includes("text") && texts >= maxTexts))) || (c === "email" && !canEmail);
                  return (
                    <label key={c} className={`flex items-center gap-1.5 text-sm ${off ? "opacity-50" : ""}`}>
                      <input type="checkbox" name={`ch_${i}`} value={c} checked={r.channels.includes(c)} disabled={off} onChange={() => toggle(i, c)} />
                      {label}
                    </label>
                  );
                })}
              </span>
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
                setList((l) => [...l, { when: unused, channels: ["push"] }])
              }
            >
              + Add a reminder
            </button>
          )}
          <p className="hint mt-0">
            {canText
              ? `Up to ${maxTexts} can be texts (${texts} used); app notifications and emails as many as you like.`
              : "To get reminders by text, turn on texts under More → Contact & notifications."}
            {!canEmail && " To get them by email, add your email there."}
          </p>
        </div>
      )}
      <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
    </form>
  );
}
