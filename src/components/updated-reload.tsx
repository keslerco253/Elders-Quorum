"use client";

import { useEffect, useState } from "react";

const FLAG = "mwl-updated";
const isStale = (v: unknown) => /Server Action .* was not found|failed-to-find-server-action/i.test(String((v as Error)?.message ?? v ?? ""));

/**
 * A save that failed because the app was updated meanwhile: reloads the page (once in
 * a row, so it can't keep reloading), which then says to do it again. True when it did.
 */
export function reloadIfStale(v: unknown): boolean {
  if (!isStale(v)) return false;
  try {
    if (sessionStorage.getItem(`${FLAG}-at`) && Date.now() - Number(sessionStorage.getItem(`${FLAG}-at`)) < 10000) return false;
    sessionStorage.setItem(`${FLAG}-at`, String(Date.now()));
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // Reload anyway.
  }
  window.location.reload();
  return true;
}

/**
 * After the app is updated, a page opened before the update can't save (its buttons
 * point to the old version), and nothing would happen: the button just says "Saving…".
 * Then the page reloads by itself and says to try again.
 */
export function UpdatedReload() {
  const [notice, setNotice] = useState(false);
  // A save that never reached the server, or that it couldn't finish (no connection,
  // the app restarting during an update): say so, rather than nothing happening.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const g = window as unknown as { __mwlFetch?: typeof fetch };
    if (g.__mwlFetch) return;
    const plain = window.fetch.bind(window);
    g.__mwlFetch = plain;
    window.fetch = async (input, init) => {
      const isSave = new Headers(init?.headers).has("next-action");
      try {
        const res = await plain(input, init);
        if (isSave && res.status >= 500) setFailed(true);
        return res;
      } catch (e) {
        if (isSave) setFailed(true);
        throw e;
      }
    };
  }, []);
  useEffect(() => {
    // The error page says it already.
    const hide = () => setFailed(false);
    window.addEventListener("mwl-error-page", hide);
    return () => window.removeEventListener("mwl-error-page", hide);
  }, []);
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => setFailed(false), 15000);
    return () => clearTimeout(t);
  }, [failed]);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLAG)) {
        sessionStorage.removeItem(FLAG);
        setNotice(true);
      }
    } catch {
      // No storage.
    }
    const reload = (v: unknown) => void reloadIfStale(v);
    const onError = (e: ErrorEvent) => reload(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reload(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  if (failed)
    return (
      <div role="alert" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
        <div className="flex max-w-md items-start gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn shadow-lg">
          <span>That didn&apos;t go through, so it wasn&apos;t saved. Check your connection (or wait a moment if the app is updating) and try again.</span>
          <button type="button" className="font-semibold" onClick={() => setFailed(false)} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
    );
  if (!notice) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <div className="flex max-w-md items-start gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn shadow-lg">
        <span>The app was just updated, so your last change wasn&apos;t saved. Please do it again (what you were typing in the agenda or notes was kept).</span>
        <button type="button" className="font-semibold" onClick={() => setNotice(false)} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
}
