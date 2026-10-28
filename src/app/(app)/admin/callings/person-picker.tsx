"use client";

import { useState } from "react";

type Person = { id: number; name: string };

/**
 * Who to give a calling: people in the organization, or, after ticking "Show all ward
 * members", anyone in the ward (someone not in the organization yet is added to it).
 */
export function PersonPicker({ id, inOrg, others, wardName, orgLabel }: { id: string; inOrg: Person[]; others: Person[]; wardName: string; orgLabel: string }) {
  const [all, setAll] = useState(inOrg.length === 0);
  const option = (p: Person) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  );
  return (
    <div className="min-w-48 flex-1 space-y-1">
      <label className="label" htmlFor={id}>
        Add a person
      </label>
      <select id={id} name="member_id" className="input" required defaultValue="" key={all ? "all" : "org"}>
        <option value="" disabled>
          Choose someone
        </option>
        {all && inOrg.length > 0 ? <optgroup label={`In ${orgLabel}`}>{inOrg.map(option)}</optgroup> : inOrg.map(option)}
        {all && others.length > 0 && <optgroup label={`Others in ${wardName} (added to ${orgLabel})`}>{others.map(option)}</optgroup>}
      </select>
      {others.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Show all {wardName} members
        </label>
      )}
    </div>
  );
}
