"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the writing boxes in the form it's in grow with what's written, from their
 * starting size up to `max` pixels (then they scroll), so longer notes can be read
 * and edited without scrolling a two-line box.
 */
export function AutoGrow({ max = 420 }: { max?: number }) {
  const here = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = here.current?.closest("form");
    if (!form) return;
    const boxes = [...form.querySelectorAll("textarea")];
    const fit = (el: HTMLTextAreaElement) => {
      // Hidden (in a folded edit form): measured when it opens.
      if (!el.offsetParent) return;
      const min = Number(el.dataset.minHeight || 0) || el.offsetHeight;
      el.dataset.minHeight = String(min);
      el.style.height = "auto";
      el.style.height = `${Math.min(Math.max(el.scrollHeight + 2, min), max)}px`;
      el.style.overflowY = el.scrollHeight + 2 > max ? "auto" : "hidden";
    };
    const all = () => boxes.forEach(fit);
    const onInput = (e: Event) => e.target instanceof HTMLTextAreaElement && fit(e.target);
    all();
    form.addEventListener("input", onInput);
    // A folded edit form being opened, or a draft put back.
    const fold = form.closest("details");
    fold?.addEventListener("toggle", all);
    const later = setTimeout(all, 50);
    window.addEventListener("resize", all);
    return () => {
      clearTimeout(later);
      form.removeEventListener("input", onInput);
      fold?.removeEventListener("toggle", all);
      window.removeEventListener("resize", all);
    };
  }, [max]);
  return <span ref={here} hidden />;
}
