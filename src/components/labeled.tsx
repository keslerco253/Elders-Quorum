import type { ReactNode } from "react";

/** A field with its name above it (the label wraps the field, so tapping the name focuses it). */
export function Labeled({ label, hint, children, className = "" }: { label: ReactNode; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="label">
        {label}
        {hint && <span className="font-normal text-muted"> ({hint})</span>}
      </span>
      {children}
    </label>
  );
}
