import { DateTime } from "luxon";
import { groupBySection } from "./agenda-sections";
import { getMeeting, MEETING_ROLES, meetingAgenda, meetingName, pendingAgenda, type Meeting } from "./meetings";
import { getOrg, getWard, orgLabel } from "./orgs";

// A meeting's agenda on paper: who it's for, when and where, the prayers and
// spiritual thought, each agenda item numbered with "Notes:" and open space to write,
// and a place for assignments made.

const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The agenda a meeting goes by: its own (another meeting, or one finished), else the waiting agenda. */
function itemsFor(orgId: number, m: Meeting) {
  return m.kind === "invited" || m.held_at ? meetingAgenda(m.id) : pendingAgenda(orgId);
}

export function agendaPrintHtml(orgId: number, meetingId: number, o: { toolbar?: "browser" | "outside" } = {}): string | null {
  const m = getMeeting(orgId, meetingId);
  const org = getOrg(orgId);
  if (!m || !org) return null;
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
    `<div class="item"><div class="topic"><span class="n">${++n}.</span><span class="body">${html(a.body.trim())}</span></div>${a.notes ? `<div class="prep">${html(a.notes.trim())}</div>` : ""}<div class="notes">Notes:</div></div>`;
  // Section by section (only those with items), numbered straight through.
  const list = items.length
    ? groupBySection(items)
        .map((g) => `<section class="sec"><h3>${html(g.label)}</h3>${g.items.map(item).join("")}</section>`)
        .join("")
    : `<p class="none">Nothing on the agenda yet.</p>`;
  const title = `${meetingName(orgId, m)}: ${day.toFormat("LLL d")}`;
  const bar =
    o.toolbar === "browser"
      ? `<div class="bar"><a href="/admin/meetings" onclick="window.close();var h=this.href;setTimeout(function(){location.href=h},200);return false;">✕ Close</a><button type="button" onclick="window.print()">Print</button></div><script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>`
      : o.toolbar === "outside"
        ? `<div class="bar"><span class="tip">No print screen? Tap the Share button, then Print.</span><button type="button" onclick="window.print()">Print</button></div><script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>`
        : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>
  @page { size: letter; margin: 0.7in 0.75in; }
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
<h2>Assignments</h2>
<table class="assign"><thead><tr><th style="width:55%">What</th><th style="width:25%">Who</th><th>When</th></tr></thead>
<tbody>${"<tr><td></td><td></td><td></td></tr>".repeat(4)}</tbody></table>
<div class="roles" style="margin-top:1.2rem">
  ${role("closing_prayer", "Closing prayer")}
</div>
<footer>Printed ${DateTime.now().setZone(ward?.timezone ?? "America/Boise").toFormat("LLL d, yyyy")} · For the ${html(group)} leaders</footer>
</body></html>`;
}
