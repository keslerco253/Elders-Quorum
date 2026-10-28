"use client";

import { useEffect } from "react";
import { inApp } from "@/lib/native-app";

/**
 * This browser's notifications go to whoever is signed in now. A subscription is moved
 * when someone signs out with the button, but not when a session simply ends (it
 * expired, cookies were cleared): then the next person to sign in on a shared computer
 * would see the last person's reminders. So the browser's subscription is claimed for
 * the member signed in (once per member per browser).
 */
export function PushOwner({ memberId }: { memberId: number }) {
  useEffect(() => {
    if (inApp() || !("serviceWorker" in navigator) || !("PushManager" in window) || Notification.permission !== "granted") return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      const mark = `${memberId} ${sub.endpoint}`;
      try {
        if (localStorage.getItem("eq-push-owner") === mark) return;
      } catch {
        // No storage: claim it each time.
      }
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (res.ok)
        try {
          localStorage.setItem("eq-push-owner", mark);
        } catch {
          // Fine.
        }
    })().catch(() => {});
  }, [memberId]);
  return null;
}
