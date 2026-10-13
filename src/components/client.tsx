"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Submit button with an optional "tap again to confirm" step. We don't use
 * window.confirm(): it can fail silently on iPhone (especially in Home Screen
 * apps), which made actions like "Remove me" do nothing.
 */
export function SubmitButton({ children, className = "btn-primary", pendingText, confirm, name, value }: { children: ReactNode; className?: string; pendingText?: string; confirm?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      // Not `disabled`: React marks the form pending during the click, and a
      // disabled button's name/value would be left out of the submitted form.
      aria-disabled={pending}
      title={confirm}
      className={`${className} ${pending ? "pointer-events-none opacity-60" : ""} ${armed ? "ring-2 ring-danger ring-offset-1" : ""}`}
      onClick={(e) => {
        if (pending) return e.preventDefault();
        if (confirm && !armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      {pending ? (pendingText ?? "Saving…") : armed ? "Tap again to confirm" : children}
    </button>
  );
}
