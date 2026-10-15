import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-muted hover:text-text">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">{children}</div>;
}

const tones = {
  neutral: "bg-surface-2 text-muted",
  info: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

/** The red count on an item that needs looking at (matches the one in the top bar). */
export function CountDot({ n, label = "new" }: { n?: number; label?: string }) {
  if (!n) return null;
  return (
    <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white" aria-label={`${n} ${label}`}>
      {n}
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

/** Shows a one-line message passed back through ?msg= after a form action. */
export function Flash({ msg, tone = "success" }: { msg?: string | string[]; tone?: "success" | "danger" | "warn" }) {
  const text = Array.isArray(msg) ? msg[0] : msg;
  if (!text) return null;
  const cls = tone === "danger" ? "bg-danger-soft text-danger" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-success-soft text-success";
  return (
    <div role="status" className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${cls}`}>
      {text.slice(0, 300)}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="h2">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
