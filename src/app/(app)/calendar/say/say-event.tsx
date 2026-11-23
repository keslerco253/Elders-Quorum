"use client";

import { useRef, useState, useTransition } from "react";
import type { EventDraft, Turn } from "@/lib/say-event";
import { addSaidEvent, sayEventStep } from "./actions";

/** "Sat, Nov 28 · 9:00 AM to 12:00 PM". */
function when(e: EventDraft): string {
  const day = e.date ? new Date(`${e.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "";
  const t = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  const time = e.all_day ? "All day" : e.start_time ? `${t(e.start_time)}${e.end_time ? ` to ${t(e.end_time)}` : ""}` : "";
  return [day, time].filter(Boolean).join(" · ");
}

/**
 * Say (or type) an event; the app shows what it understood and asks for anything
 * missing, one question at a time. Nothing is added until Add to calendar.
 */
export function SayEvent({ choices }: { choices: { id: number; label: string }[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const said = text.trim();
    if (!said || busy) return;
    const next: Turn[] = [...turns, { who: "member", text: said }];
    setTurns(next);
    setText("");
    setError("");
    start(async () => {
      const res = await sayEventStep(next);
      if (res.error || !res.step) {
        setError(res.error ?? "Please try again.");
        return;
      }
      setDraft(res.step.draft);
      setReady(res.step.ready);
      if (res.step.question) setTurns([...next, { who: "app", text: res.step.question }]);
      box.current?.focus();
    });
  };
  const add = () =>
    draft &&
    start(async () => {
      const res = await addSaidEvent(draft);
      if (res?.error) setError(res.error);
    });
  const startOver = () => {
    setTurns([]);
    setDraft(null);
    setReady(false);
    setError("");
    setText("");
    box.current?.focus();
  };
  const calendar = draft
    ? draft.kind === "org"
      ? `${choices.find((c) => c.id === draft.org_id)?.label ?? "An organization"}${draft.leaders_only ? " · leaders only" : ""}`
      : "Your calendar (only you)"
    : "";

  return (
    <div className="max-w-xl space-y-4">
      {turns.length === 0 && (
        <p className="text-sm text-muted">
          Say what it is, when and where, like <em>&ldquo;Wilson family move-in Saturday at 9 at 123 Main Street{choices.length ? ", for the quorum" : ""}&rdquo;</em>. Tap in the box, then the 🎤 to talk (on an iPhone, use the microphone on the keyboard). I&apos;ll ask about anything missing.
        </p>
      )}
      {turns.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {turns.map((t, i) => (
            <li key={i} className={`flex ${t.who === "member" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${t.who === "member" ? "bg-primary text-primary-text" : "border border-border bg-surface"}`}>{t.text}</div>
            </li>
          ))}
          {busy && (
            <li className="flex justify-start">
              <div className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-muted">…</div>
            </li>
          )}
        </ul>
      )}

      {draft && (draft.title || draft.date) && (
        <div className="card space-y-1.5" aria-label="The event so far">
          <div className="text-xs font-semibold tracking-wide text-accent uppercase">{ready ? "Ready to add" : "So far"}</div>
          <div className="text-lg font-semibold">{draft.title || <span className="text-muted">(no title yet)</span>}</div>
          <div className="text-sm">{when(draft) || <span className="text-muted">(no day yet)</span>}</div>
          {draft.location && <div className="text-sm text-muted">📍 {draft.location}</div>}
          {draft.notes && <div className="text-sm whitespace-pre-wrap text-muted">{draft.notes}</div>}
          <div className="text-sm text-muted">📅 {calendar}</div>
          {ready && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="btn-primary" onClick={add} disabled={busy}>
                {busy ? "Adding…" : "Add to calendar"}
              </button>
              <button type="button" className="btn-secondary" onClick={startOver} disabled={busy}>
                Start over
              </button>
            </div>
          )}
          {ready && <p className="hint">Something&apos;s not right? Say what to change below (&ldquo;make it 10&rdquo;, &ldquo;it&apos;s just for me&rdquo;).</p>}
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="space-y-2"
      >
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          maxLength={1000}
          className="input"
          placeholder={turns.length ? "Your answer…" : "Say or type the event…"}
          aria-label={turns.length ? "Your answer" : "The event"}
        />
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy || !text.trim()}>
            {turns.length ? "Send" : "Next"}
          </button>
          {turns.length > 0 && !ready && (
            <button type="button" className="btn-secondary" onClick={startOver} disabled={busy}>
              Start over
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
