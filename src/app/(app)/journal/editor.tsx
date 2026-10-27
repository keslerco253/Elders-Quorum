"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_JOURNAL_ENTRY } from "@/lib/journal-limits";
import { saveJournalText } from "./actions";
import { UnlockForm } from "./unlock-form";

type Status = "idle" | "saving" | "saved" | "failed" | "locked";

/**
 * One journal entry, saved as it's typed (a moment after they stop, and when they
 * leave the box or the page). A blank one becomes a new entry once something is
 * written in it.
 */
export function JournalEditor({ id: startId, date, initial = "", time, placeholder }: { id?: number; date: string; initial?: string; time?: string; placeholder?: string }) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(startId ?? null);
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [savedAt, setSavedAt] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(initial);
  const latest = useRef(initial);
  const idRef = useRef<number | null>(startId ?? null);
  const running = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // One save at a time, so a new entry is only made once.
  const save = useCallback(() => {
    clearTimeout(timer.current);
    running.current = running.current.then(async () => {
      const body = latest.current;
      if (body === saved.current) return;
      setStatus("saving");
      try {
        const r = await saveJournalText({ id: idRef.current, date, body });
        // A journal with a passcode locked itself: ask for it here, then save.
        if (r.error === "locked") return setStatus("locked");
        if (r.error) throw new Error(r.error);
        if (r.id && r.id !== idRef.current) {
          idRef.current = r.id;
          setId(r.id);
        }
        saved.current = body;
        setStatus(latest.current === body ? "saved" : "saving");
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      } catch {
        setStatus("failed");
      }
    });
    return running.current;
  }, [date]);

  // Grow with what's written.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
  }, [text]);

  // Save what's left when they leave the page or put the app away.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", away);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", away);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [save]);

  const isNew = !startId;
  return (
    <div className="space-y-1">
      {time && <div className="text-xs text-muted">{time}</div>}
      <textarea
        ref={box}
        value={text}
        maxLength={MAX_JOURNAL_ENTRY}
        onChange={(e) => {
          setText(e.target.value);
          latest.current = e.target.value;
          setStatus("idle");
          clearTimeout(timer.current);
          timer.current = setTimeout(save, 800);
        }}
        onBlur={save}
        placeholder={placeholder}
        aria-label={isNew ? "New journal entry" : "Journal entry"}
        className="input min-h-[120px] resize-none font-serif text-base leading-relaxed"
      />
      {status === "locked" && (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p>Your journal locked itself. Enter your passcode to save what you wrote.</p>
          <UnlockForm compact onOpen={() => save()} />
        </div>
      )}
      <div className="flex min-h-6 flex-wrap items-center gap-3 text-xs text-muted">
        <span aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? `Saved ✓ ${savedAt}` : status === "failed" ? <span className="text-danger">Not saved yet. Check your connection; it tries again as you type.</span> : ""}
        </span>
        {isNew && id && (
          <button
            type="button"
            className="link ml-auto"
            onClick={async () => {
              await save();
              router.refresh();
            }}
          >
            + Start another entry
          </button>
        )}
      </div>
    </div>
  );
}
