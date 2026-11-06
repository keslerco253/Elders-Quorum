"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const PREFIX = "mwl-draft:";
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

type Field = HTMLTextAreaElement | HTMLInputElement;
type Draft = { at: number; fields: Record<string, string> };

/** The form's typed fields: text boxes, not hidden fields, files, dates or choices. */
function typedFields(form: HTMLFormElement): Field[] {
  return [
    ...form.querySelectorAll<Field>("textarea[name], input[name]"),
  ].filter(
    (el) =>
      el instanceof HTMLTextAreaElement ||
      ["text", "search", "url", ""].includes(el.getAttribute("type") ?? ""),
  );
}

function read(key: string): Draft | null {
  try {
    const d = JSON.parse(
      localStorage.getItem(PREFIX + key) || "null",
    ) as Draft | null;
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
 * shows the same thing, or (`addsTo`) an item with that wording is on the list.
 */
export function KeepDraft({
  id,
  addsTo,
}: {
  id: string;
  /** An Add form: the attribute (on each listed item) holding its wording. */ addsTo?: string;
}) {
  const here = useRef<HTMLSpanElement>(null);
  const { pending } = useFormStatus();
  const [note, setNote] = useState<"" | "restored" | "failed">("");
  // What was sent with the last save, to check it went through.
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
        if (fields.every((el) => el.value.trim() === el.defaultValue.trim()))
          localStorage.removeItem(PREFIX + id);
        else
          localStorage.setItem(
            PREFIX + id,
            JSON.stringify({
              at: Date.now(),
              fields: Object.fromEntries(
                fields.map((el) => [el.name, el.value]),
              ),
            } satisfies Draft),
          );
      } catch {
        // No storage: nothing kept.
      }
    };
    const submitting = () => {
      keep();
      sent.current = Object.fromEntries(
        typedFields(form).map((el) => [el.name, el.value]),
      );
    };
    form.addEventListener("input", keep);
    form.addEventListener("submit", submitting, true);
    return () => {
      form.removeEventListener("input", keep);
      form.removeEventListener("submit", submitting, true);
    };
  }, [id, addsTo]);

  // A save finished: if what was sent doesn't show on the page (no connection, the app
  // updating), put it back in the boxes and say so, instead of an empty box.
  useEffect(() => {
    if (pending || !sent.current) return;
    const fields = sent.current;
    const t = setTimeout(() => {
      const form = here.current?.closest("form");
      if (!form) return;
      sent.current = null;
      if (isSaved(form, fields, addsTo)) {
        forget(id);
        setNote("");
      } else {
        putBack(form, fields);
        setNote("failed");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [pending, id, addsTo]);

  return (
    <span
      ref={here}
      role="status"
      className={note ? "basis-full text-xs text-warn" : "hidden"}
    >
      {note === "restored" &&
        "↺ Put back what you were writing (it wasn't saved yet)."}
      {note === "failed" &&
        "⚠️ That didn't save (no connection, or the app was updating). What you wrote is still here: tap the button again."}
    </span>
  );
}

/** Saved: the form now shows what was written, or (an Add form) an item with that wording is listed. */
function isSaved(
  form: HTMLFormElement,
  fields: Record<string, string>,
  addsTo?: string,
): boolean {
  const els = typedFields(form);
  if (
    els.every(
      (el) =>
        (fields[el.name] ?? el.defaultValue).trim() === el.defaultValue.trim(),
    )
  )
    return true;
  const body = Object.values(fields)
    .find((v) => v.trim())
    ?.trim();
  return (
    !!addsTo &&
    !!body &&
    [...document.querySelectorAll(`[${addsTo}]`)].some(
      (el) => el.getAttribute(addsTo)?.trim() === body,
    )
  );
}

function putBack(form: HTMLFormElement, fields: Record<string, string>) {
  for (const el of typedFields(form))
    if (fields[el.name] !== undefined) el.value = fields[el.name];
  // An edit form folded away: open it to show what came back.
  const fold = form.closest("details");
  if (fold) fold.open = true;
}
