// The sections of a meeting's agenda, in the order they come up. A new item goes under
// Presidency business unless another is chosen; a member's message put on the agenda
// goes under Members & families.

export const AGENDA_SECTIONS = [
  ["presidency", "Presidency business"],
  ["temple", "Temple, family history & missionary work"],
  ["ministering", "Ministering"],
  ["members", "Members & families"],
  ["welfare", "Welfare & service"],
  ["activities", "Activities & calendar"],
] as const;

export type AgendaSection = (typeof AGENDA_SECTIONS)[number][0];

export const isAgendaSection = (v: unknown): v is AgendaSection => AGENDA_SECTIONS.some(([k]) => k === v);
export const sectionLabel = (k: string) => AGENDA_SECTIONS.find(([s]) => s === k)?.[1] ?? AGENDA_SECTIONS[0][1];
const order = (k: string) => Math.max(0, AGENDA_SECTIONS.findIndex(([s]) => s === k));

/** Items in section order (keeping their order within each section). */
export function bySection<T extends { category: string }>(items: T[]): T[] {
  return items.map((a, i) => ({ a, i })).sort((x, y) => order(x.a.category) - order(y.a.category) || x.i - y.i).map((x) => x.a);
}

/** The sections that have items, each with its items. */
export function groupBySection<T extends { category: string }>(items: T[]): { key: AgendaSection; label: string; items: T[] }[] {
  return AGENDA_SECTIONS.map(([key, label]) => ({ key, label, items: items.filter((a) => (isAgendaSection(a.category) ? a.category : "presidency") === key) })).filter((g) => g.items.length);
}
