"use client";

import { useEffect, useMemo, useState } from "react";
import { personalText, smsHref } from "@/lib/sms-link";

type Person = { id: number; name: string; first: string; phone: string | null };
type Choice = { value: string; label: string; ids: number[] };
type Link = { label: string; url: string };

/** More than this many in a group text: some phones and carriers won't send it, and everyone sees everyone's number. */
const GROUP_MAX = 10;
const OTHER = "other";

/** Text a list from your own phone: one group text, or one person at a time (starting with their first name). */
export function PhoneTexter({ orgId, initial, choices, people, links, body: start }: { orgId: number; initial: string; choices: Choice[]; people: Person[]; links: Link[]; body: string }) {
  const pick = `pick:${orgId}`;
  const [to, setTo] = useState(initial);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [body, setBody] = useState(start);
  const [useName, setUseName] = useState(true);
  const [link, setLink] = useState("");
  const [otherLink, setOtherLink] = useState("");
  const [mode, setMode] = useState<"group" | "each">("each");
  const [done, setDone] = useState<Set<number>>(new Set());
  const [device, setDevice] = useState<{ apple: boolean; phone: boolean }>({ apple: false, phone: true });
  useEffect(() => {
    const ua = navigator.userAgent;
    const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setDevice({ apple, phone: apple || /Android/i.test(ua) });
  }, []);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const chosen = (to === pick ? [...picked] : (choices.find((c) => c.value === to)?.ids ?? [])).map((id) => byId.get(id)).filter((p): p is Person => !!p);
  chosen.sort((a, b) => a.name.localeCompare(b.name));
  const list = chosen.filter((p): p is Person & { phone: string } => !!p.phone);
  const noPhone = chosen.filter((p) => !p.phone);
  const names = useMemo(() => people.map((p) => p.first), [people]);
  const url = link === OTHER ? (/^https?:\/\/\S+$/i.test(otherLink.trim()) ? otherLink.trim() : "") : link;
  const each = mode === "each" || list.length === 1;
  const textFor = (p?: Person) => personalText(body, { first: each && useName ? p?.first : undefined, link: url, names });
  const next = list.find((p) => !done.has(p.id));
  const preview = list.length ? (each ? (next ?? list[0]) : undefined) : undefined;
  const mark = (id: number) => setDone((s) => new Set(s).add(id));
  const choose = (v: string) => {
    setTo(v);
    setDone(new Set());
  };

  return (
    <div className="card max-w-2xl space-y-4">
      {!device.phone && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">Open this page on your phone: the buttons open your phone&apos;s Messages app. On a computer they may not do anything.</p>
      )}
      <div>
        <label className="label" htmlFor="phone-to">
          To
        </label>
        <select id="phone-to" className="input" value={to} onChange={(e) => choose(e.target.value)}>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} ({c.ids.length})
            </option>
          ))}
          <option value={pick}>Choose people…</option>
        </select>
        {to === pick && (
          <div className="mt-2 rounded-lg border border-border">
            <div className="flex flex-wrap gap-3 border-b border-border px-3 py-2 text-sm">
              <button type="button" className="link" onClick={() => setPicked(new Set(people.filter((p) => p.phone).map((p) => p.id)))}>
                Everyone with a number
              </button>
              <button type="button" className="link" onClick={() => setPicked(new Set())}>
                None
              </button>
              <span className="text-muted">{picked.size} chosen</span>
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {people.map((p) => (
                <li key={p.id}>
                  <label className={`flex items-center gap-2 px-3 py-2 text-sm ${p.phone ? "" : "text-muted"}`}>
                    <input
                      type="checkbox"
                      disabled={!p.phone}
                      checked={picked.has(p.id)}
                      onChange={(e) =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(p.id);
                          else n.delete(p.id);
                          return n;
                        })
                      }
                    />
                    {p.name}
                    {!p.phone && <span className="text-xs">(no phone number)</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-1 text-xs text-muted">
          {list.length} {list.length === 1 ? "person" : "people"} with a phone number
          {noPhone.length > 0 && ` · no number for ${noPhone.map((p) => p.name).join(", ")} (send them the message in the app instead)`}
        </p>
      </div>

      <div>
        <label className="label" htmlFor="phone-text-body">
          Message
        </label>
        <textarea id="phone-text-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} className="input" placeholder="Write your message" />
        <label className={`mt-2 flex items-start gap-2 text-sm ${each ? "" : "text-muted"}`}>
          <input type="checkbox" className="mt-1" checked={useName && each} disabled={!each} onChange={(e) => setUseName(e.target.checked)} />
          <span>
            Start with their first name (&quot;Hyrum, …&quot;)
            {!each && <span className="block text-xs">One at a time only: a group text is the same for everyone.</span>}
          </span>
        </label>
      </div>

      <div>
        <label className="label" htmlFor="phone-link">
          Add a link
        </label>
        <select id="phone-link" className="input" value={link} onChange={(e) => setLink(e.target.value)}>
          <option value="">No link</option>
          {links.map((l) => (
            <option key={l.url} value={l.url}>
              {l.label}
            </option>
          ))}
          <option value={OTHER}>Another link…</option>
        </select>
        {link === OTHER && <input className="input mt-2" type="url" inputMode="url" value={otherLink} onChange={(e) => setOtherLink(e.target.value)} placeholder="https://…" aria-label="Link" />}
        {link && link !== OTHER && !link.includes("/l/") && <p className="mt-1 text-xs text-muted">Opens in My Ward Link, so it works for members who use the app.</p>}
      </div>

      {list.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold text-muted">Preview{preview ? ` (for ${preview.name})` : ""}</div>
          <div className="whitespace-pre-wrap break-words">{textFor(preview) || <span className="text-muted">Write a message above.</span>}</div>
        </div>
      )}

      {list.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="label">Send it as</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" className="mt-1" checked={mode === "each"} onChange={() => setMode("each")} />
            <span>
              <strong>One at a time</strong>, a separate text to each person
              <span className="block text-xs text-muted">Each is private, with their name, and replies come just to you. Messages opens for each person: send it, come back here, and tap the next one.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" className="mt-1" checked={mode === "group"} onChange={() => setMode("group")} />
            <span>
              <strong>One group text</strong> to all {list.length}
              <span className="block text-xs text-muted">
                The same words for everyone; everyone sees each other&apos;s numbers and every reply.{list.length > GROUP_MAX ? ` With more than ${GROUP_MAX} people, some phones won't send it.` : ""}
              </span>
            </span>
          </label>
        </fieldset>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted">{to === pick ? "Tick the people to text." : "No one here has a phone number."}</p>
      ) : !each ? (
        <a href={smsHref(list.map((p) => p.phone), textFor(), device.apple)} className="btn-primary inline-flex">
          📱 Open a group text to {list.length}
        </a>
      ) : (
        <div className="space-y-3">
          {next ? (
            <a href={smsHref([next.phone], textFor(next), device.apple)} onClick={() => mark(next.id)} className="btn-primary inline-flex">
              📱 Text {next.name}
              {list.length > 1 ? ` (${done.size + 1} of ${list.length})` : ""}
            </a>
          ) : (
            <p className="text-sm font-medium text-success">✓ You&apos;ve opened a text to everyone on the list.</p>
          )}
          {list.length > 1 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {list.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className={done.has(p.id) ? "text-muted" : ""}>
                    {done.has(p.id) ? "✓ " : ""}
                    {p.name}
                  </span>
                  <a href={smsHref([p.phone], textFor(p), device.apple)} onClick={() => mark(p.id)} className="btn-secondary btn-sm">
                    {done.has(p.id) ? "Again" : "Text"}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {done.size > 0 && (
            <button type="button" className="link text-sm" onClick={() => setDone(new Set())}>
              Start the list over
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-muted">The app doesn&apos;t see these texts or replies: they&apos;re between your phone and theirs.</p>
    </div>
  );
}
