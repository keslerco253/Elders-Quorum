import Papa from "papaparse";

export interface Mapping {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface ImportRow {
  name: string;
  displayName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface ExistingMember {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  source: string;
  role: string;
}

export interface ImportPlan {
  creates: ImportRow[];
  updates: { id: number; row: ImportRow; changes: string[] }[];
  unchanged: number;
  /** Imported, regular members who are on the app but not in this file (moved out?). */
  missing: ExistingMember[];
  skipped: number;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return { headers: (res.meta.fields ?? []).filter(Boolean), rows: res.data };
}

/** Guesses which CSV column holds each field, based on LCR's headers. */
export function guessMapping(headers: string[]): Mapping {
  const find = (re: RegExp) => headers.find((h) => re.test(h)) ?? "";
  return {
    name: find(/^(preferred\s+)?name\b|^full\s*name/i) || find(/name/i),
    address: find(/address/i),
    phone: find(/phone/i),
    email: find(/e-?mail/i),
  };
}

/** LCR lists names as "Last, First Middle"; show them as "First Middle Last". */
export function displayNameFrom(lcrName: string) {
  const [last, ...rest] = lcrName.split(",");
  const first = rest.join(",").trim();
  return first ? `${first} ${last.trim()}` : lcrName.trim();
}

const clean = (v: string | undefined) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s : null;
};

export function toRows(records: Record<string, string>[], m: Mapping): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of records) {
    const name = clean(r[m.name]);
    if (!name) {
      skipped++;
      continue;
    }
    const email = clean(m.email ? r[m.email] : undefined)?.toLowerCase() ?? null;
    rows.push({
      name,
      displayName: displayNameFrom(name),
      address: m.address ? clean(r[m.address]) : null,
      phone: m.phone ? clean(r[m.phone]) : null,
      email: email && email.includes("@") ? email : null,
    });
  }
  return { rows, skipped };
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Matches file rows to existing members (by name, then email) and works out
 * what will change. Blank cells never erase information already in the app.
 */
export function planImport(rows: ImportRow[], existing: ExistingMember[], skipped = 0): ImportPlan {
  const byName = new Map(existing.map((e) => [key(e.name), e]));
  const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email!.toLowerCase(), e]));
  const seen = new Set<number>();
  const plan: ImportPlan = { creates: [], updates: [], unchanged: 0, missing: [], skipped };

  for (const row of rows) {
    const match = byName.get(key(row.name)) ?? (row.email ? byEmail.get(row.email) : undefined);
    if (!match || seen.has(match.id)) {
      plan.creates.push(row);
      continue;
    }
    seen.add(match.id);
    const changes: string[] = [];
    if (row.email && row.email !== match.email?.toLowerCase()) changes.push("email");
    if (row.phone && row.phone !== match.phone) changes.push("phone");
    if (row.address && row.address !== match.address) changes.push("address");
    if (match.status !== "active") changes.push("re-activated");
    if (changes.length) plan.updates.push({ id: match.id, row, changes });
    else plan.unchanged++;
  }

  plan.missing = existing.filter((e) => !seen.has(e.id) && e.status === "active" && e.source === "import" && e.role === "member");
  return plan;
}
