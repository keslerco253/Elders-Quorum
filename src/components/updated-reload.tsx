"use client";

import { useEffect, useState } from "react";

const FLAG = "mwl-updated";
const isStale = (v: unknown) => /Server Action .* was not found|failed-to-find-server-action/i.test(String((v as Error)?.message ?? v ?? ""));

/**
 * After the app is updated, a page opened before the update can't save (its buttons
 * point to the old version), and nothing would happen: the button just says "Saving…".
 * Then the page reloads by itself and says to try again.
 */
export function UpdatedReload() {
  const [notice, setNotice] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLAG)) {
        sessionStorage.removeItem(FLAG);
        setNotice(true);
      }
    } catch {
      // No storage.
    }
    const reload = (v: unknown) => {
      if (!isStale(v)) return;
      try {
        // Only once in a row, so it can't keep reloading.
        if (sessionStorage.getItem(`${FLAG}-at`) && Date.now() - Number(sessionStorage.getItem(`${FLAG}-at`)) < 10000) return;
        sessionStorage.setItem(`${FLAG}-at`, String(Date.now()));
        sessionStorage.setItem(FLAG, "1");
      } catch {
        // Reload anyway.
      }
      window.location.reload();
    };
    const onError = (e: ErrorEvent) => reload(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reload(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  if (!notice) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <div className="flex max-w-md items-start gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn shadow-lg">
        <span>The app was just updated, so your last change wasn&apos;t saved. Please do it again.</span>
        <button type="button" className="font-semibold" onClick={() => setNotice(false)} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
}
