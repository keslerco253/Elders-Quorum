"use client";

import { useEffect, useState } from "react";
import { smsHref } from "@/lib/sms-link";

type Person = { id: number; name: string; phone: string };

/** More than this many in a group text: some phones and carriers won't send it, and everyone sees everyone's number. */
const GROUP_MAX = 10;

/** Text a list from your own phone: one group text, or one person at a time. */
export function PhoneTexter({
  people,
  body: start,
}: {
  people: Person[];
  body: string;
}) {
  const [body, setBody] = useState(start);
  const [mode, setMode] = useState<"group" | "each">(
    people.length > GROUP_MAX ? "each" : "group",
  );
  const [done, setDone] = useState<Set<number>>(new Set());
  const [device, setDevice] = useState<{ apple: boolean; phone: boolean }>({
    apple: false,
    phone: true,
  });
  useEffect(() => {
    const ua = navigator.userAgent;
    const apple =
      /iPhone|iPad|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setDevice({ apple, phone: apple || /Android/i.test(ua) });
  }, []);
  if (!people.length)
    return (
      <p className="card max-w-2xl text-sm">
        No one on this list has a phone number.
      </p>
    );
  const next = people.find((p) => !done.has(p.id));
  const mark = (id: number) => setDone((s) => new Set(s).add(id));
  return (
    <div className="card max-w-2xl space-y-4">
      {!device.phone && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
          Open this page on your phone: the buttons open your phone&apos;s
          Messages app. On a computer they may not do anything.
        </p>
      )}
      <div>
        <label className="label" htmlFor="phone-text-body">
          Message
        </label>
        <textarea
          id="phone-text-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={2000}
          className="input"
        />
        <p className="mt-1 text-xs text-muted">
          You can still change it in Messages before you send it.
        </p>
      </div>
      {people.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="label">Send it as</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              className="mt-1"
              checked={mode === "group"}
              onChange={() => setMode("group")}
            />
            <span>
              <strong>One group text</strong> to all {people.length}
              <span className="block text-xs text-muted">
                Everyone sees each other&apos;s numbers and every reply.
                {people.length > GROUP_MAX
                  ? ` With more than ${GROUP_MAX} people, some phones won't send it: one at a time is safer.`
                  : ""}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              className="mt-1"
              checked={mode === "each"}
              onChange={() => setMode("each")}
            />
            <span>
              <strong>One at a time</strong>, a separate text to each person
              <span className="block text-xs text-muted">
                Each is private, and replies come just to you. Messages opens
                for each person: send it, come back here, and tap the next one.
              </span>
            </span>
          </label>
        </fieldset>
      )}
      {people.length === 1 ? (
        <a
          href={smsHref([people[0].phone], body, device.apple)}
          className="btn-primary inline-flex"
        >
          📱 Text {people[0].name}
        </a>
      ) : mode === "group" ? (
        <a
          href={smsHref(
            people.map((p) => p.phone),
            body,
            device.apple,
          )}
          className="btn-primary inline-flex"
        >
          📱 Open a group text to {people.length}
        </a>
      ) : (
        <div className="space-y-3">
          {next ? (
            <a
              href={smsHref([next.phone], body, device.apple)}
              onClick={() => mark(next.id)}
              className="btn-primary inline-flex"
            >
              📱 Text {next.name} ({done.size + 1} of {people.length})
            </a>
          ) : (
            <p className="text-sm font-medium text-success">
              ✓ You&apos;ve opened a text to everyone on the list.
            </p>
          )}
          <ul className="divide-y divide-border rounded-lg border border-border">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className={done.has(p.id) ? "text-muted" : ""}>
                  {done.has(p.id) ? "✓ " : ""}
                  {p.name}
                </span>
                <a
                  href={smsHref([p.phone], body, device.apple)}
                  onClick={() => mark(p.id)}
                  className="btn-secondary btn-sm"
                >
                  {done.has(p.id) ? "Again" : "Text"}
                </a>
              </li>
            ))}
          </ul>
          {done.size > 0 && (
            <button
              type="button"
              className="link text-sm"
              onClick={() => setDone(new Set())}
            >
              Start the list over
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-muted">
        The app doesn&apos;t see these texts or replies: they&apos;re between
        your phone and theirs.
      </p>
    </div>
  );
}
