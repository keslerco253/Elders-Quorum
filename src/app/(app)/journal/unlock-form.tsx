"use client";

import { useState } from "react";
import { unlockJournalAction } from "./actions";

/** The passcode box: opens the journal, then `onOpen` (go on to the page, or save again). */
export function UnlockForm({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={compact ? "flex flex-wrap items-center gap-2" : "space-y-3"}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const r = await unlockJournalAction(passcode).catch(() => ({ ok: false, error: "That didn't work. Check your connection and try again." }));
        setBusy(false);
        if (r.ok) onOpen();
        else setError(r.error || "That passcode isn't right.");
      }}
    >
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        autoComplete="current-password"
        autoFocus={!compact}
        required
        aria-label="Journal passcode"
        placeholder="Journal passcode"
        className={compact ? "input w-48 py-1" : "input"}
      />
      <button className={compact ? "btn-primary btn-sm" : "btn-primary w-full"} disabled={busy}>
        {busy ? "Opening…" : compact ? "Unlock and save" : "🔓 Open my journal"}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
