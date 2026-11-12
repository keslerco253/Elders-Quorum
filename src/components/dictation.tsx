"use client";

import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;
type Field = HTMLTextAreaElement | HTMLInputElement;

const TYPES = ["text", "search", ""];

/** A box people write in (not passwords, emails, numbers, dates or codes). */
function writable(el: EventTarget | null): el is Field {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled && !el.closest("[data-no-dictation]");
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  return TYPES.includes(type) && !el.readOnly && !el.disabled && el.autocomplete !== "one-time-code" && !el.closest("[data-no-dictation]");
}

/** Puts words in the box at the cursor the way typing would, so the page sees them (drafts, counters, saving). */
function insert(el: Field, words: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  let text = words.trim();
  if (!text) return;
  // A capital letter to start a sentence, and spaces between words.
  if (!before.trim() || /[.!?]\s*$/.test(before)) text = text[0].toUpperCase() + text.slice(1);
  if (before && !/\s$/.test(before)) text = " " + text;
  if (after && !/^\s/.test(after)) text += " ";
  const max = el.maxLength > 0 ? el.maxLength : Infinity;
  const value = (before + text + after).slice(0, max);
  const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  const caret = Math.min(before.length + text.length, value.length);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * A microphone on whatever writing box has the cursor: tap it and talk, and the words
 * are typed in (tap again to stop). Only where the browser can turn speech into text
 * (Chrome, Edge, Safari); elsewhere nothing shows, and phones' keyboards have their own.
 */
export function Dictation() {
  const [Ctor, setCtor] = useState<RecognitionCtor | null>(null);
  const [field, setField] = useState<Field | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState("");
  const rec = useRef<Recognition | null>(null);
  const target = useRef<Field | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const c = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
    if (c) setCtor(() => c);
  }, []);

  useEffect(() => {
    if (!Ctor) return;
    const onFocus = (e: FocusEvent) => {
      if (!writable(e.target)) return;
      // Moving to another box stops listening for the old one.
      if (rec.current && target.current !== e.target) rec.current.stop();
      setField(e.target);
    };
    const onBlur = () =>
      // Tapping the microphone keeps the box; going elsewhere hides it.
      setTimeout(() => {
        if (!writable(document.activeElement) && !rec.current) setField(null);
      }, 150);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, [Ctor]);

  // Keep the microphone on the box as the page scrolls or the box grows.
  useEffect(() => {
    if (!field) return setBox(null);
    let raf = 0;
    const place = () => {
      raf = 0;
      if (!field.isConnected) {
        // The box is gone (sent, or a new page): stop listening.
        rec.current?.stop();
        setField(null);
        return;
      }
      setBox(field.getBoundingClientRect());
    };
    const later = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", later, true);
    window.addEventListener("resize", later);
    field.addEventListener("input", later);
    return () => {
      window.removeEventListener("scroll", later, true);
      window.removeEventListener("resize", later);
      field.removeEventListener("input", later);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [field]);

  useEffect(() => () => rec.current?.stop(), []);

  if (!Ctor || !field || !box || box.width === 0) return null;

  const stop = () => rec.current?.stop();
  const start = () => {
    setProblem("");
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = false;
    target.current = field;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal && target.current) insert(target.current, e.results[i][0].transcript);
    };
    r.onerror = (e) => setProblem(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Allow the microphone for this site to talk instead of typing." : e.error === "no-speech" ? "" : "Couldn't hear that. Tap the microphone to try again.");
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
    }
  };

  const multi = field instanceof HTMLTextAreaElement;
  const size = 32;
  const top = multi ? box.top + 4 : box.top + (box.height - size) / 2;
  const left = box.right - size - 4;
  if (top < 0 || top > window.innerHeight) return null;
  return (
    <>
      <button
        type="button"
        aria-label={listening ? "Stop talking" : "Talk instead of typing"}
        title={listening ? "Stop" : "Talk instead of typing"}
        // Keep the cursor in the box.
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => (listening ? stop() : start())}
        style={{ position: "fixed", top, left, width: size, height: size, zIndex: 60 }}
        className={`flex items-center justify-center rounded-full border shadow-sm ${listening ? "animate-pulse border-danger bg-danger text-white" : "border-border bg-surface text-muted hover:text-text"}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      {(listening || problem) && (
        <div role="status" style={{ position: "fixed", top: Math.max(4, top - 30), left: Math.max(8, left - 180), zIndex: 60 }} className="rounded-lg bg-text px-2.5 py-1 text-xs text-bg shadow">
          {problem || "Listening… tap the microphone to stop"}
        </div>
      )}
    </>
  );
}
