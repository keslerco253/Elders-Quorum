"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, className = "btn-primary", pendingText, confirm, name, value }: { children: ReactNode; className?: string; pendingText?: string; confirm?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      // Not `disabled`: React marks the form pending during the click, and a
      // disabled button's name/value would be left out of the submitted form.
      aria-disabled={pending}
      className={`${className} ${pending ? "pointer-events-none opacity-60" : ""}`}
      onClick={(e) => {
        if (pending || (confirm && !window.confirm(confirm))) e.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
