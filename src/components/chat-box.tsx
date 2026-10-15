"use client";

import { useEffect, useRef } from "react";

/**
 * The message box in a conversation. Keeps an unsent draft if you leave and come back,
 * and sends with Ctrl+Enter (⌘+Enter on a Mac), like email and chat apps.
 */
export function ChatBox({ draftKey, ...props }: { draftKey: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const box = useRef<HTMLTextAreaElement>(null);
  const key = `draft:${draftKey}`;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    try {
      const saved = localStorage.getItem(key);
      if (saved && !el.value) el.value = saved;
    } catch {}
    const form = el.form;
    const clear = () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    };
    form?.addEventListener("submit", clear);
    return () => form?.removeEventListener("submit", clear);
  }, [key]);
  return (
    <textarea
      ref={box}
      {...props}
      onInput={(e) => {
        try {
          const v = e.currentTarget.value;
          if (v.trim()) localStorage.setItem(key, v);
          else localStorage.removeItem(key);
        } catch {}
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
