"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const PREFIX = "mwl-draft:";
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
/** Sent by UpdatedReload when a save didn't reach the server (or it couldn't finish). */
export const SAVE_FAILED = "mwl-save-failed";

type Field = HTMLTextAreaElement | HTMLInputElement;
type Draft = { at: number; fields: Record<string, string> };

/** The form's typed fields: text boxes, not hidden fields, files, dates or choices. */
function typedFields(form: HTMLFormElement): Field[] {
  return [...form.querySelectorAll<Field>("textarea[name], input[name]")].filter((el) => el instanceof HTMLTextAreaElement || ["text", "search", "url", ""].includes(el.getAttribute("type") ?? ""));
}

/** Compared without the difference in line endings a sent form makes (\r\n), or spaces at the ends. */
const same = (a: string, b: string) => a.replace(/\r\n?/g, "\n").trim() === b.replace(/\r\n?/g, "\n").trim();

function read(key: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(PREFIX + key) || "null") as Draft | null;
    return d && Date.now() - d.at < KEEP_MS ? d : null;
  } catch {
    return null;
  }
}

function forget(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // No storage.
  }
}

/**
 * Keeps what's typed in the form it's in (on this device), so a reload, the app
 * coming back from the background, a pull-down or an error while saving doesn't lose
 * it. It's put back the next time the form shows, unless it was saved: the form then
 * shows the same thing, or (`addsTo`) an item with that wording is on the list. A save
 * that didn't reach the server puts the writing back in the boxes and says so.
 */
export function KeepDraft({ id, addsTo }: { id: string; /** An Add form: the attribute (on each listed item) holding its wording. */ addsTo?: string }) {
  const here = useRef<HTMLSpanElement>(null);
  const { pending } = useFormStatus();
  const [note, setNote] = useState<"" | "restored" | "failed">("");
  // What was sent with the last save, until it's known how it went.
  const sent = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const form = here.current?.closest("form");
    if (!form) return;
    const saved = read(id);
    if (saved) {
      if (isSaved(form, saved.fields, addsTo)) forget(id);
      else {
        putBack(form, saved.fields);
        setNote("restored");
      }
    }
    const keep = () => {
      const fields = typedFields(form);
      try {
        if (fields.every((el) => same(el.value, el.defaultValue))) localStorage.removeItem(PREFIX + id);
        else localStorage.setItem(PREFIX + id, JSON.stringify({ at: Date.now(), fields: Object.fromEntries(fields.map((el) => [el.name, el.value])) } satisfies Draft));
      } catch {
        // No storage: nothing kept.
      }
    };
    const submitting = () => {
      keep();
      sent.current = Object.fromEntries(typedFields(form).map((el) => [el.name, el.value]));
      setNote("");
    };
    // Only a save that really failed (no connection, the server restarting) says so.
    const failed = () => {
      if (!sent.current) return;
      putBack(form, sent.current);
      sent.current = null;
      setNote("failed");
    };
    form.addEventListener("input", keep);
    form.addEventListener("submit", submitting, true);
    window.addEventListener(SAVE_FAILED, failed);
    return () => {
      form.removeEventListener("input", keep);
      form.removeEventListener("submit", submitting, true);
      window.removeEventListener(SAVE_FAILED, failed);
    };
  }, [id, addsTo]);

  // A save finished without failing: once the page shows it, the draft isn't needed.
  useEffect(() => {
    if (pending || !sent.current) return;
    const fields = sent.current;
    const t = setTimeout(() => {
      const form = here.current?.closest("form");
      if (!form || sent.current !== fields) return;
      sent.current = null;
      if (isSaved(form, fields, addsTo)) forget(id);
    }, 500);
    return () => clearTimeout(t);
  }, [pending, id, addsTo]);

  return (
    <span ref={here} role="status" className={note ? "basis-full text-xs text-warn" : "hidden"}>
      {note === "restored" && "↺ Put back what you were writing (it wasn't saved yet)."}
      {note === "failed" && "⚠️ That didn't save (no connection, or the app was updating). What you wrote is still here: tap the button again."}
    </span>
  );
}

/** Saved: the form now shows what was written, or (an Add form) an item with that wording is listed. */
function isSaved(form: HTMLFormElement, fields: Record<string, string>, addsTo?: string): boolean {
  if (typedFields(form).every((el) => same(fields[el.name] ?? el.defaultValue, el.defaultValue))) return true;
  const body = Object.values(fields).find((v) => v.trim());
  return !!addsTo && !!body && [...document.querySelectorAll(`[${addsTo}]`)].some((el) => same(el.getAttribute(addsTo) ?? "", body));
}

function putBack(form: HTMLFormElement, fields: Record<string, string>) {
  for (const el of typedFields(form)) if (fields[el.name] !== undefined) el.value = fields[el.name];
  // Boxes that grow with their writing fit it again.
  form.dispatchEvent(new Event("input", { bubbles: true }));
  // An edit form folded away: open it to show what came back.
  const fold = form.closest("details");
  if (fold) fold.open = true;
}
