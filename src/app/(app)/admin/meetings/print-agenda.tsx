"use client";

import { useEffect, useState } from "react";
import { appHandlesFiles, inApp, postToApp } from "@/lib/native-app";
import { agendaHandoffAction } from "./actions";

/**
 * 🖨️ Print agenda: a clean page to print (or save as a PDF). In the phone app it's
 * handed to the phone's print screen (older apps: the phone's browser, which can print).
 */
export function PrintAgendaButton({ meetingId }: { meetingId: number }) {
  const [where, setWhere] = useState<"browser" | "app" | "old-app">("browser");
  const [busy, setBusy] = useState(false);
  useEffect(() => setWhere(appHandlesFiles() ? "app" : inApp() ? "old-app" : "browser"), []);
  const href = `/admin/meetings/${meetingId}/print`;
  if (where === "browser")
    return (
      <a href={`${href}?print=1`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
        🖨️ Print agenda
      </a>
    );
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          if (where === "app") {
            const res = await fetch(href, { credentials: "same-origin" });
            if (res.ok) postToApp({ type: "print", html: await res.text() });
          } else {
            const r = await agendaHandoffAction(meetingId);
            if (r.url) postToApp({ type: "open", url: r.url });
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Getting it ready…" : "🖨️ Print agenda"}
    </button>
  );
}
