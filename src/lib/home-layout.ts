import { db } from "./db";

// The order of the sections on a member's Home page, and which they've hidden
// (More → Customize Home). Things that need an answer always stay at the top.

export const HOME_SECTIONS = [
  { key: "assignments", label: "Your assignments" },
  { key: "conducting", label: "Conducting this Sunday", note: "Presidency" },
  { key: "lessons", label: "This Sunday's lesson", note: "One for each organization" },
  { key: "coming_up", label: "Coming up" },
  { key: "challenge", label: "Challenge" },
  { key: "serve", label: "Ways to serve" },
  { key: "visit", label: "Would you like a visit?" },
  { key: "church_apps", label: "Church apps" },
] as const;

export type HomeSection = (typeof HOME_SECTIONS)[number]["key"];

const KEYS: string[] = HOME_SECTIONS.map((s) => s.key);
const isKey = (k: unknown): k is HomeSection => typeof k === "string" && KEYS.includes(k);

export interface HomeLayout {
  order: HomeSection[];
  hidden: HomeSection[];
  /** Whether it's been changed from the usual. */
  custom: boolean;
}

/**
 * A member's Home layout. Sections added since they customized go in their usual
 * place: right after the section that comes before them in the usual order.
 */
export function homeLayout(memberId: number): HomeLayout {
  const raw = (db().prepare("SELECT home_layout FROM members WHERE id = ?").get(memberId) as { home_layout: string | null } | undefined)?.home_layout;
  let saved: { order?: unknown; hidden?: unknown } = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  const order = Array.isArray(saved.order) ? [...new Set(saved.order.filter(isKey))] : [];
  KEYS.forEach((k, i) => {
    if (order.includes(k as HomeSection)) return;
    const before = KEYS.slice(0, i).reverse().find((b) => order.includes(b as HomeSection));
    order.splice(before ? order.indexOf(before as HomeSection) + 1 : 0, 0, k as HomeSection);
  });
  const hidden = Array.isArray(saved.hidden) ? [...new Set(saved.hidden.filter(isKey))] : [];
  return { order, hidden, custom: !!raw };
}

function save(memberId: number, layout: { order: HomeSection[]; hidden: HomeSection[] } | null) {
  db().prepare("UPDATE members SET home_layout = ? WHERE id = ?").run(layout ? JSON.stringify({ order: layout.order, hidden: layout.hidden }) : null, memberId);
}

/** Moves a section one place up (-1) or down (1). */
export function moveHomeSection(memberId: number, key: string, by: -1 | 1) {
  if (!isKey(key)) return;
  const { order, hidden } = homeLayout(memberId);
  const i = order.indexOf(key);
  const j = i + by;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  save(memberId, { order, hidden });
}

export function setHomeSectionHidden(memberId: number, key: string, hide: boolean) {
  if (!isKey(key)) return;
  const { order, hidden } = homeLayout(memberId);
  save(memberId, { order, hidden: hide ? [...new Set([...hidden, key])] : hidden.filter((h) => h !== key) });
}

export function resetHomeLayout(memberId: number) {
  save(memberId, null);
}
