"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/client";
import { newChallenge } from "./actions";

type Team = { name: string; orgIds: number[] };
type Item = { label: string; points: string };

/** A new challenge: name, dates, teams of organizations, and what counts for how many points. */
export function ChallengeForm({ orgs, mine, today, defaults }: { orgs: { id: number; name: string }[]; mine: number; today: string; defaults: { label: string; points: number }[] }) {
  const [teams, setTeams] = useState<Team[]>([
    { name: "", orgIds: [mine] },
    { name: "", orgIds: [] },
  ]);
  const [items, setItems] = useState<Item[]>(defaults.map((d) => ({ label: d.label, points: String(d.points) })));
  const used = (except: number) => new Set(teams.flatMap((t, i) => (i === except ? [] : t.orgIds)));
  const toggle = (ti: number, id: number) =>
    setTeams((ts) => ts.map((t, i) => (i !== ti ? t : { ...t, orgIds: t.orgIds.includes(id) ? t.orgIds.filter((x) => x !== id) : [...t.orgIds, id] })));
  const setItem = (i: number, patch: Partial<Item>) => setItems((l) => l.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <form action={newChallenge} className="card max-w-2xl space-y-5">
      <input type="hidden" name="teams" value={JSON.stringify(teams)} />
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ label: i.label, points: Number(i.points) })))} />
      <div>
        <label className="label" htmlFor="title">
          Name
        </label>
        <input id="title" name="title" required maxLength={120} className="input" placeholder="e.g. Fall Temple & Family History Challenge" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="starts_on">
            Starts
          </label>
          <input id="starts_on" name="starts_on" type="date" required defaultValue={today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ends_on">
            Ends
          </label>
          <input id="ends_on" name="ends_on" type="date" required className="input" />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="label">Teams</legend>
        {teams.map((t, ti) => {
          const taken = used(ti);
          return (
            <div key={ti} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold">Team {ti + 1}</span>
                <input
                  value={t.name}
                  onChange={(e) => setTeams((ts) => ts.map((x, i) => (i === ti ? { ...x, name: e.target.value } : x)))}
                  maxLength={80}
                  className="input flex-1 py-1 text-sm"
                  placeholder="Team name (optional)"
                  aria-label={`Team ${ti + 1} name`}
                />
                {teams.length > 2 && (
                  <button type="button" className="text-muted hover:text-danger" aria-label={`Remove team ${ti + 1}`} onClick={() => setTeams((ts) => ts.filter((_, i) => i !== ti))}>
                    ✕
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {orgs.map((o) => (
                  <label key={o.id} className={`flex items-center gap-2 text-sm ${taken.has(o.id) ? "opacity-40" : ""}`}>
                    <input type="checkbox" checked={t.orgIds.includes(o.id)} disabled={taken.has(o.id)} onChange={() => toggle(ti, o.id)} /> {o.name}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setTeams((ts) => [...ts, { name: "", orgIds: [] }])}>
          + Add a team
        </button>
        <p className="hint">Each team is one or more organizations, e.g. Elders Quorum against Relief Society, or two against two. The name defaults to the organizations&apos; names.</p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="label">What counts</legend>
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} maxLength={80} className="input flex-1 py-1 text-sm" aria-label={`Thing ${i + 1}`} />
            <input
              value={it.points}
              onChange={(e) => setItem(i, { points: e.target.value })}
              inputMode="decimal"
              className="input w-16 py-1 text-center text-sm"
              aria-label={`Points for ${it.label || `thing ${i + 1}`}`}
            />
            <span className="text-xs text-muted">pt</span>
            <button type="button" className="text-muted hover:text-danger" aria-label={`Remove ${it.label}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setItems((l) => [...l, { label: "", points: "1" }])}>
          + Add something
        </button>
        <p className="hint">Points for each one (e.g. 1 per ordinance, 1 per hour). Members log how many they did.</p>
      </fieldset>

      <SubmitButton pendingText="Starting…">Start the challenge</SubmitButton>
      <p className="hint">Everyone on the teams gets a notification. Only team totals are shown: no one sees what anyone else logged.</p>
    </form>
  );
}
