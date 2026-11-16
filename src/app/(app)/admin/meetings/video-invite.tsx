"use client";

import { useState } from "react";

type Person = { id: number; display_name: string; presidency: boolean };

/** Who gets a Join button when the video meeting starts: the presidency, chosen people, or no one. */
export function VideoInvite({ people, leaders }: { people: Person[]; leaders: string }) {
  const [who, setWho] = useState<"presidency" | "people" | "me">("presidency");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const shown = people.filter((p) => !q.trim() || p.display_name.toLowerCase().includes(q.trim().toLowerCase()));
  const group = (title: string, list: Person[]) =>
    list.length > 0 && (
      <div>
        <div className="mb-1 text-xs font-semibold text-muted uppercase">{title}</div>
        {list.map((p) => (
          <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
            <input type="checkbox" name="people" value={p.id} checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
            {p.display_name}
          </label>
        ))}
      </div>
    );
  const option = (value: typeof who, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name="who" value={value} checked={who === value} onChange={() => setWho(value)} />
      {label}
    </label>
  );
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-sm font-semibold">Send the Join link to</legend>
      {option("presidency", `The ${leaders}`)}
      {option("people", "People I choose (any of the members, the presidency too)")}
      {who === "people" && (
        <div className="ml-6 space-y-2 rounded-lg bg-surface-2 p-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className="input py-1 text-sm" placeholder="Find a name" aria-label="Find a name" />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {group(`The ${leaders}`, shown.filter((p) => p.presidency))}
            {group("Members", shown.filter((p) => !p.presidency))}
            {shown.length === 0 && <p className="text-sm text-muted">No one by that name.</p>}
          </div>
          {/* Keep the ones chosen even while a search hides them. */}
          {[...picked].filter((id) => !shown.some((p) => p.id === id)).map((id) => (
            <input key={id} type="hidden" name="people" value={id} />
          ))}
          <p className="hint">{picked.size ? `${picked.size} chosen.` : "Tick everyone to invite."}</p>
        </div>
      )}
      {option("me", "No one (just open it)")}
    </fieldset>
  );
}
