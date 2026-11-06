"use client";

import { useEffect, useRef, useState } from "react";
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
  // When it was armed: a quick double tap isn't a confirmation.
  const armedAt = useRef(0);

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
          armedAt.current = Date.now();
          setArmed(true);
        } else if (confirm && Date.now() - armedAt.current < 800) {
          // The second tap of a double tap: they haven't seen the question yet.
          e.preventDefault();
        }
      }}
    >
      {pending ? (pendingText ?? "Saving…") : armed ? "Tap again to confirm" : children}
      {/* The question, where it can be read (small buttons can't show it). */}
      {armed && confirm && !pending && (
        <span role="alert" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 text-left font-normal normal-case tracking-normal">
          <span className="max-w-md rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn shadow-lg">
            <strong className="font-semibold">{confirm}</strong> Tap the button again to confirm.
          </span>
        </span>
      )}
    </button>
  );
}
