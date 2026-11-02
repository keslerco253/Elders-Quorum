"use client";

import { useEffect, useState } from "react";
import { appHandlesFiles, inApp, postToApp } from "@/lib/native-app";
import { agendaHandoffAction, notesHandoffAction } from "./actions";

type Where = "browser" | "app" | "old-app";

function useWhere(): Where {
  const [where, setWhere] = useState<Where>("browser");
  useEffect(() => setWhere(appHandlesFiles() ? "app" : inApp() ? "old-app" : "browser"), []);
  return where;
}

/**
 * Prints a page made for paper: in a browser it opens in a new tab with the print
 * screen; in the phone app it's handed to the phone's print screen (older apps: the
 * phone's browser, which can print).
 */
async function printInApp(where: Where, href: string, handoff: () => Promise<{ url?: string }>) {
  if (where === "app") {
    const res = await fetch(href, { credentials: "same-origin" });
    if (res.ok) postToApp({ type: "print", html: await res.text() });
  } else {
    const r = await handoff();
    if (r.url) postToApp({ type: "open", url: r.url });
  }
}

function PrintLink({ href, handoff, label, className = "btn-secondary btn-sm" }: { href: string; handoff: () => Promise<{ url?: string }>; label: string; className?: string }) {
  const where = useWhere();
  const [busy, setBusy] = useState(false);
  if (where === "browser")
    return (
      <a href={`${href}${href.includes("?") ? "&" : "?"}print=1`} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
    );
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await printInApp(where, href, handoff);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Getting it ready…" : label}
    </button>
  );
}

/** 🖨️ Print agenda (a finished meeting: its notes). */
export function PrintAgendaButton({ meetingId, finished = false }: { meetingId: number; finished?: boolean }) {
  return <PrintLink href={`/admin/meetings/${meetingId}/print`} handoff={() => agendaHandoffAction(meetingId)} label={finished ? "🖨️ Print notes" : "🖨️ Print agenda"} />;
}

/** Past meetings' notes for review: choose how far back, then print. */
export function PrintPastNotes({ ranges }: { ranges: [string, string][] }) {
  const [months, setMonths] = useState(ranges[0][0]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={months} onChange={(e) => setMonths(e.target.value)} className="input w-auto py-1 text-sm" aria-label="Which meetings">
        {ranges.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <PrintLink href={`/admin/meetings/notes?months=${months}`} handoff={() => notesHandoffAction(months)} label="🖨️ Print notes" />
    </div>
  );
}
