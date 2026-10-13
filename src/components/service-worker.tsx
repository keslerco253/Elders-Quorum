"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // A tapped notification asks an already-open app to go to its page.
    const onMessage = (e: MessageEvent) => {
      const url = e.data?.type === "open" ? String(e.data.url || "") : "";
      if (url && new URL(url, location.origin).origin === location.origin) location.assign(url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  return null;
}
