"use client";

import { useEffect } from "react";

/**
 * Tapping or clicking anywhere in a date or time box opens its calendar or clock (on a
 * computer only the small icon does, otherwise). Phones open it on a tap anyway.
 */
export function DatePickers() {
  useEffect(() => {
    const open = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !["date", "time", "datetime-local"].includes(el.type) || el.disabled || el.readOnly) return;
      try {
        el.showPicker?.();
      } catch {
        // Not allowed here (or already open): the browser's own way still works.
      }
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);
  return null;
}
