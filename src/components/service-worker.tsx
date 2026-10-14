"use client";

import { useEffect } from "react";
import { appPushOff, inApp, onAppPush, postToApp, registerAppToken } from "@/lib/native-app";

export function ServiceWorker() {
  useEffect(() => {
    // Inside the phone app: refresh this phone's notification token with the
    // server on each launch (if notifications are allowed and not turned off).
    if (inApp()) {
      const off = onAppPush((s) => {
        if (!appPushOff()) registerAppToken(s).catch(() => {});
      });
      postToApp({ type: "ready" });
      return off;
    }
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // A tapped notification asks an already-open app to go to its page.
    const onMessage = (e: MessageEvent) => {
      const url = e.data?.type === "open" ? String(e.data.url || "") : "";
      if (url && /^https?:$/.test(new URL(url, location.origin).protocol)) location.assign(url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  return null;
}
