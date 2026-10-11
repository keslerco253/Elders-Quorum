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
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
