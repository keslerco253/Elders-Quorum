"use client";

import { useEffect, useState } from "react";
import {
  appHasTabs,
  onAppLock,
  postToApp,
  type AppLockStatus,
} from "@/lib/native-app";

/** In the phone app: lock it with Face ID (or Touch ID, fingerprint, passcode). */
export function AppLockToggle() {
  const [lock, setLock] = useState<AppLockStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!appHasTabs()) return;
    const off = onAppLock((s) => {
      setLock(s);
      setBusy(false);
    });
    postToApp({ type: "lockStatus" });
    return off;
  }, []);
  if (!lock?.available) return null;
  return (
    <section className="mb-6">
      <h2 className="h2 mb-2">Privacy</h2>
      <div className="card flex items-center justify-between gap-3 text-sm">
        <div>
          <div className="font-medium">Lock with {lock.kind}</div>
          <div className="text-muted">
            Asks for {lock.kind} when you open the app, so only you can see your
            ward&apos;s messages and members.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={lock.on}
          aria-label={`Lock with ${lock.kind}`}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            postToApp({ type: "setLock", on: !lock.on });
          }}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${lock.on ? "bg-accent" : "bg-surface-2 border border-border"}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${lock.on ? "left-[1.4rem]" : "left-0.5"}`}
          />
        </button>
      </div>
    </section>
  );
}
