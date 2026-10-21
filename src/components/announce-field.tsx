"use client";

import { useMemo, useState } from "react";

/**
 * "Send a notification" (when adding something) or "Send an update" (when changing
 * it), and to whom: tick any of the choices (everyone, groups...) and add people by name.
 */
export function AnnounceField({
  choices,
  people,
  label,
  about,
  hint,
}: {
  choices: { value: string; label: string }[];
  people: { id: number; name: string }[];
  label: string;
  about: string;
  hint?: string;
}) {
  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(choices[0] ? [choices[0].value] : []));
  const [added, setAdded] = useState<{ id: number; name: string }[]>([]);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return people.filter((p) => !added.some((a) => a.id === p.id) && words.every((w) => p.name.toLowerCase().includes(w))).slice(0, 8);
  }, [q, people, added]);
  const toggle = (v: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="announce" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1" />
        <span>
          <strong>{label}</strong>
          <span className="block text-muted">{about}</span>
        </span>
      </label>
      {on && (
        <fieldset className="ml-6 space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-semibold">Send it to (tick as many as you like)</legend>
          <div className="space-y-1 text-sm">
            {choices.map((c) => (
              <label key={c.value} className="flex items-start gap-2">
                <input type="checkbox" name="announce_to" value={c.value} checked={picked.has(c.value)} onChange={() => toggle(c.value)} className="mt-1" />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="announce-person">
              Add people
            </label>
            {added.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {added.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm text-accent">
                    <input type="hidden" name="announce_to" value={`m:${p.id}`} />
                    {p.name}
                    <button type="button" aria-label={`Remove ${p.name}`} className="ml-0.5 font-bold" onClick={() => setAdded((a) => a.filter((x) => x.id !== p.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              id="announce-person"
              className="input"
              placeholder="Type a name"
              value={q}
              autoComplete="off"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[0]) {
                    setAdded((a) => [...a, matches[0]]);
                    setQ("");
                  }
                }
              }}
            />
            {matches.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-lg border border-border bg-surface text-sm">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-surface-2"
                      onClick={() => {
                        setAdded((a) => [...a, p]);
                        setQ("");
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hint && <p className="hint">{hint}</p>}
        </fieldset>
      )}
    </div>
  );
}
