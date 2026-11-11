import { DateTime } from "luxon";
import { groupBySection } from "./agenda-sections";
import { getMeeting, MEETING_ROLES, meetingAgenda, meetingName, orgMeetings, pendingAgenda, type Meeting } from "./meetings";
import { getOrg, getWard, hasFeature, orgLabel } from "./orgs";
import { assignmentReview, orgTodos } from "./assignments";

// A meeting's agenda on paper (or, once it's finished, its notes): who it's for, when and where, the prayers and
// spiritual thought, each agenda item numbered with "Notes:" and open space to write,
// and a place for assignments made.

const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The agenda a meeting goes by: its own (another meeting, or one finished), else the waiting agenda. */
function itemsFor(orgId: number, m: Meeting) {
  return m.kind === "invited" || m.held_at ? meetingAgenda(m.id) : pendingAgenda(orgId);
}

const PAGE_CSS = `  @page { size: letter; margin: 0.7in 0.75in; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; background: #fff; margin: 0 auto; max-width: 7.5in; padding: 1.5rem 1.25rem; line-height: 1.45; }
  header { text-align: center; padding-bottom: .9rem; border-bottom: 2px solid #1d3a5f; margin-bottom: 1.1rem; }
  .group { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .78rem; letter-spacing: .14em; text-transform: uppercase; color: #2b6f9e; font-weight: 600; }
  h1 { font-size: 1.9rem; font-weight: normal; margin: .2rem 0 .15rem; color: #1d3a5f; }
  .when { font-size: 1.05rem; }
  .where { color: #6b7280; font-size: .95rem; margin-top: .1rem; }
  .roles { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem 1.5rem; margin: 0 0 1.2rem; }
  .role { display: flex; align-items: baseline; gap: .5rem; font-size: .98rem; }
  .role .label { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; white-space: nowrap; }
  .role .who { flex: 1; border-bottom: 1px solid #cbd5e1; min-height: 1.3em; padding-left: .2rem; }
  h2 { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .85rem; letter-spacing: .12em; text-transform: uppercase; color: #1d3a5f; margin: 1.1rem 0 .5rem; padding-bottom: .25rem; border-bottom: 1px solid #e5e7eb; }
  .item { padding: .55rem 0 0; border-top: 1px solid #e3e8ee; break-inside: avoid; }
  .sec h3 { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .74rem; letter-spacing: .1em; text-transform: uppercase; color: #2b6f9e; margin: .9rem 0 .1rem; break-after: avoid; }
  h2 + .sec h3 { margin-top: .2rem; }
  .sec h3 + .item { border-top: none; }
  .topic { display: flex; font-size: 1.08rem; font-weight: 600; color: #1d3a5f; }
  .topic .n { flex: none; min-width: 1.6rem; }
  .topic .body { white-space: pre-wrap; overflow-wrap: anywhere; }
  .prep { margin: .15rem 0 0 1.6rem; font-style: italic; color: #4b5563; font-size: .92rem; white-space: pre-wrap; }
  .notes { margin: .35rem 0 0 1.6rem; height: 1.1in; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .78rem; color: #6b7280; }
  .none { color: #6b7280; font-style: italic; }
  .assign { width: 100%; border-collapse: collapse; font-size: .9rem; }
  .assign th { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; font-weight: 600; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; padding: 0 .3rem .2rem; }
  .assign td { border-bottom: 1px solid #e5e7eb; height: 1.9em; }
  footer { margin-top: 1.4rem; text-align: center; font-family: system-ui, sans-serif; font-size: .7rem; color: #9ca3af; }
  .bar { display: flex; gap: .5rem; justify-content: flex-end; padding: 0 0 1rem; font-family: system-ui, sans-serif; }
  .bar a, .bar button { font: inherit; font-size: .9rem; padding: .45rem .9rem; border-radius: .5rem; border: 1px solid #d1d5db; background: #fff; color: #1f2937; text-decoration: none; cursor: pointer; }
  .bar button { background: #1d3a5f; border-color: #1d3a5f; color: #fff; }
  .bar .tip { margin-right: auto; color: #6b7280; font-size: .8rem; align-self: center; }
  @media print { .bar { display: none; } body { padding: 0; max-width: none; } }
  .meeting { margin-top: 1.6rem; padding-top: 1rem; border-top: 2px solid #1d3a5f; }
  .meeting:first-of-type { margin-top: 0; padding-top: 0; border-top: none; }
  .meeting h2.mt { font-family: Georgia, "Times New Roman", serif; text-transform: none; letter-spacing: 0; font-size: 1.25rem; font-weight: normal; color: #1d3a5f; border: none; margin: 0 0 .15rem; padding: 0; }
  .meta { font-size: .92rem; color: #4b5563; margin-bottom: .2rem; }
  .meta b { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; font-weight: 600; margin-right: .3rem; }
  .taken { margin: .2rem 0 .5rem 1.6rem; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .98rem; }
  .taken.empty { color: #9ca3af; font-style: italic; font-size: .88rem; }
  .other { white-space: pre-wrap; overflow-wrap: anywhere; }
  .assign td.filled { height: auto; padding: .3rem; vertical-align: top; }
  h3.sub { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: .74rem; letter-spacing: .1em; text-transform: uppercase; color: #2b6f9e; margin: .7rem 0 .2rem; }
`;

const PRINT_ON_LOAD = `<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>`;

// Reading it on screen: Print sends it to the phone app's print screen there (the app's
// window can't print by itself), else the browser's. The bar isn't printed.
const REVIEW_PRINT = `<script>function mwlPrint(){var a=window.MyWardLinkApp,w=window.ReactNativeWebView;if(a&&a.files&&w){var d=document.documentElement.cloneNode(true);var b=d.querySelector(".bar");if(b)b.remove();d.querySelectorAll("script").forEach(function(s){s.remove()});w.postMessage(JSON.stringify({type:"print",html:"<!doctype html>"+d.outerHTML}));}else if(a){alert("This version of the app can't print. Update the app, or print from a computer.");}else{window.print();}}</script>`;

/** Print and Close above the page (not printed); "outside": in the phone's browser, which can't close it; "review": to read on screen, with Back and Print. */
function toolbar(kind?: "browser" | "outside" | "review", back = "/admin/meetings") {
  if (kind === "review")
    return `<div class="bar"><a href="${back}" style="margin-right:auto">← Back</a><button type="button" onclick="mwlPrint()">🖨️ Print</button></div>${REVIEW_PRINT}`;
  if (kind === "browser")
    return `<div class="bar"><a href="/admin/meetings" onclick="window.close();var h=this.href;setTimeout(function(){location.href=h},200);return false;">✕ Close</a><button type="button" onclick="window.print()">Print</button></div>${PRINT_ON_LOAD}`;
  if (kind === "outside") return `<div class="bar"><span class="tip">No print screen? Tap the Share button, then Print.</span><button type="button" onclick="window.print()">Print</button></div>${PRINT_ON_LOAD}`;
  return "";
}

function orgHeading(orgId: number) {
  const org = getOrg(orgId);
  if (!org) return null;
  const ward = getWard(org.ward_id);
  const group = ward ? orgLabel(org, ward) : org.name;
  // "Villas Ward · Elders Quorum" (or just the ward, for the bishopric).
  return { group, heading: ward && org.kind !== "ward" ? `${ward.name} · ${group}` : group, tz: ward?.timezone ?? "America/Boise" };
}

/** Notes as written, with "## Heading" lines and **bold** shown as bold instead of the marks. */
const noteText = (s: string) =>
  html(s.trim())
    .replace(/^#{1,6}\s+(.*)$/gm, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** Assignments completed since the last presidency meeting, and those still open, to review. */
function reviewHtml(orgId: number, meetingId: number, tz: string) {
  const { since, completed, open } = assignmentReview(orgId, meetingId);
  const today = DateTime.now().setZone(tz).toISODate()!;
  const rows = (list: typeof open) =>
    list
      .map((t) => {
        const flag = t.done ? "Done" : t.due_date && t.due_date < today ? "Overdue" : t.assignee_id && t.accept_status === "pending" ? "Not accepted" : !t.assignee_id ? "Unassigned" : "";
        const when = t.done ? (t.done_at ? DateTime.fromSQL(t.done_at, { zone: "utc" }).setZone(tz).toFormat("LLL d") : "") : t.due_date ? DateTime.fromISO(t.due_date).toFormat("LLL d") : "";
        return `<tr><td class="filled">${html(t.title)}</td><td class="filled">${html(t.assignee ?? "Unassigned")}</td><td class="filled">${when}</td><td class="filled">${flag}</td></tr>`;
      })
      .join("");
  const table = (list: typeof open, whenLabel: string) =>
    list.length
      ? `<table class="assign"><thead><tr><th style="width:48%">What</th><th style="width:22%">Who</th><th style="width:12%">${whenLabel}</th><th></th></tr></thead><tbody>${rows(list)}</tbody></table>`
      : `<p class="none">None.</p>`;
  const sinceText = since ? `since the last meeting (${DateTime.fromSQL(since, { zone: "utc" }).setZone(tz).toFormat("LLL d")})` : "in the last 30 days";
  return `<h2>Assignment review</h2>
<h3 class="sub">Completed ${sinceText}</h3>${table(completed, "Done")}
<h3 class="sub">Still open</h3>${table(open, "Due")}`;
}

/** "📎 handout.pdf, budget.xlsx" under an agenda item. */
const attached = (a: { files?: { original_name: string }[] }) =>
  a.files?.length ? `<div class="prep">📎 ${a.files.map((f) => html(f.original_name)).join(", ")}</div>` : "";

const whenText = (m: Meeting) =>
  [DateTime.fromISO(m.date).toFormat("cccc, LLLL d, yyyy"), m.time ? DateTime.fromFormat(m.time, "HH:mm").toFormat("h:mm a") : ""].filter(Boolean).join(" · ");

/**
 * Finished meetings on paper, for review: for each, when and where, who was there, the
 * prayers, each agenda item with the notes taken on it, other notes, and the
 * assignments made. Oldest first.
 */
export function recordsPrintHtml(orgId: number, meetings: Meeting[], o: { toolbar?: "browser" | "outside" | "review"; back?: string; range?: string } = {}): string | null {
  const h = orgHeading(orgId);
  if (!h) return null;
  const list = [...meetings].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const block = (m: Meeting) => {
    let n = 0;
    const items = meetingAgenda(m.id);
    const agenda = items.length
      ? groupBySection(items)
          .map(
            (g) =>
              `<section class="sec"><h3>${html(g.label)}</h3>${g.items
                .map(
                  (a) =>
                    `<div class="item" style="padding-bottom:.1rem"><div class="topic"><span class="n">${++n}.</span><span class="body">${html(a.body.trim())}</span></div>${attached(a)}${a.notes.trim() ? `<div class="taken">${noteText(a.notes)}</div>` : `<div class="taken empty">No notes</div>`}</div>`,
                )
                .join("")}</section>`,
          )
          .join("")
      : `<p class="none">No agenda items were filed with this meeting.</p>`;
    const roles = MEETING_ROLES.filter(([k]) => m[k]).map(([k, label]) => `${label}: ${html(m[k])}`).join(" · ");
    const todos = orgTodos(orgId, { meetingId: m.id });
    return `<div class="meeting">
  <h2 class="mt">${html(meetingName(orgId, m))} · ${html(whenText(m))}</h2>
  ${m.location ? `<div class="meta">${html(m.location)}</div>` : ""}
  ${m.attendees ? `<div class="meta"><b>There</b>${html(m.attendees)}</div>` : ""}
  ${roles ? `<div class="meta"><b>Prayers &amp; thought</b>${roles}</div>` : ""}
  <h2>Agenda</h2>${agenda}
  ${m.notes.trim() ? `<h2>Other notes</h2><div class="other">${noteText(m.notes)}</div>` : ""}
  ${
    todos.length
      ? `<h2>Assignments</h2><table class="assign"><thead><tr><th style="width:55%">What</th><th style="width:25%">Who</th><th>Due</th></tr></thead><tbody>${todos
          .map(
            (t) =>
              `<tr><td class="filled">${html(t.title)}${t.done ? " ✓" : ""}</td><td class="filled">${html(t.assignee ?? "Unassigned")}</td><td class="filled">${t.due_date ? DateTime.fromISO(t.due_date).toFormat("LLL d") : ""}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : ""
  }
</div>`;
  };
  const title = list.length === 1 ? `${meetingName(orgId, list[0])}: ${DateTime.fromISO(list[0].date).toFormat("LLL d")} notes` : "Meeting notes";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>
${PAGE_CSS}
</style></head><body>
${toolbar(o.toolbar, o.back)}
<header>
  <div class="group">${html(h.heading)}</div>
  <h1>${list.length === 1 ? "Meeting notes" : "Meeting notes for review"}</h1>
  <div class="when">${list.length === 1 ? "" : html(o.range ?? `${list.length} meetings`)}</div>
</header>
${list.length ? list.map(block).join("\n") : `<p class="none">No finished meetings in that time.</p>`}
<footer>Printed ${DateTime.now().setZone(h.tz).toFormat("LLL d, yyyy")} · For the ${html(h.group)} leaders only</footer>
</body></html>`;
}

export function agendaPrintHtml(orgId: number, meetingId: number, o: { toolbar?: "browser" | "outside" | "review"; back?: string } = {}): string | null {
  const m = getMeeting(orgId, meetingId);
  const org = getOrg(orgId);
  if (!m || !org) return null;
  // A finished meeting prints what was noted, for review.
  if (m.held_at) return recordsPrintHtml(orgId, [m], o);
  const ward = getWard(org.ward_id);
  const group = ward ? orgLabel(org, ward) : org.name;
  // "Villas Ward · Elders Quorum" (or just the ward, for the bishopric).
  const heading = ward && org.kind !== "ward" ? `${ward.name} · ${group}` : group;
  const day = DateTime.fromISO(m.date);
  const when = [day.toFormat("cccc, LLLL d, yyyy"), m.time ? DateTime.fromFormat(m.time, "HH:mm").toFormat("h:mm a") : ""].filter(Boolean).join(" · ");
  const items = itemsFor(orgId, m);
  const role = (k: (typeof MEETING_ROLES)[number][0], label: string) =>
    `<div class="role"><span class="label">${label}</span><span class="who">${m[k] ? html(m[k]) : ""}</span></div>`;
  // Each item: its number and wording, any notes added ahead of time, then "Notes:" and
  // open space to write in the meeting.
  let n = 0;
  const item = (a: (typeof items)[number]) =>
    `<div class="item"><div class="topic"><span class="n">${++n}.</span><span class="body">${html(a.body.trim())}</span></div>${attached(a)}${a.notes ? `<div class="prep">${html(a.notes.trim())}</div>` : ""}<div class="notes">Notes:</div></div>`;
  // Section by section (only those with items), numbered straight through.
  const list = items.length
    ? groupBySection(items)
        .map((g) => `<section class="sec"><h3>${html(g.label)}</h3>${g.items.map(item).join("")}</section>`)
        .join("")
    : `<p class="none">Nothing on the agenda yet.</p>`;
  const title = `${meetingName(orgId, m)}: ${day.toFormat("LLL d")}`;
  const bar = toolbar(o.toolbar, o.back);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>
${PAGE_CSS}
</style></head><body>
${bar}
<header>
  <div class="group">${html(heading)}</div>
  <h1>${html(meetingName(orgId, m))}</h1>
  <div class="when">${html(when)}</div>
  ${m.location ? `<div class="where">${html(m.location)}</div>` : ""}
</header>
<div class="roles">
  ${role("opening_prayer", "Opening prayer")}
  ${role("spiritual_thought", "Spiritual thought")}
</div>
<h2>Agenda</h2>
${list}
${m.kind === "presidency" && hasFeature(org, "todos") ? reviewHtml(orgId, m.id, ward?.timezone ?? "America/Boise") : ""}
<h2>New assignments</h2>
<table class="assign"><thead><tr><th style="width:55%">What</th><th style="width:25%">Who</th><th>When</th></tr></thead>
<tbody>${"<tr><td></td><td></td><td></td></tr>".repeat(4)}</tbody></table>
<div class="roles" style="margin-top:1.2rem">
  ${role("closing_prayer", "Closing prayer")}
</div>
<footer>Printed ${DateTime.now().setZone(ward?.timezone ?? "America/Boise").toFormat("LLL d, yyyy")} · For the ${html(group)} leaders</footer>
</body></html>`;
}

export const NOTES_RANGES: [string, string][] = [
  ["3", "Last 3 months"],
  ["6", "Last 6 months"],
  ["12", "Last year"],
  ["all", "All past meetings"],
];

/** Finished meetings from the last few months (or all), to print for review. */
export function pastNotesHtml(orgId: number, months: string | null, today: string, o: { toolbar?: "browser" | "outside" | "review"; back?: string } = {}) {
  const range = NOTES_RANGES.find(([k]) => k === months) ?? NOTES_RANGES[0];
  const from = range[0] === "all" ? "" : DateTime.fromISO(today).minus({ months: Number(range[0]) }).toISODate()!;
  const meetings = orgMeetings(orgId).filter((m) => m.held_at && m.date >= from);
  return recordsPrintHtml(orgId, meetings, { ...o, range: range[1] });
}
