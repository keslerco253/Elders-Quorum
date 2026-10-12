"use client";

import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function PushToggle({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const { publicKey } = await (await fetch("/api/push")).json();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      setState("on");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  // On the home screen only nudge people who can still turn notifications on.
  if (compact && state !== "off" && state !== "ios-install") return null;

  const box = "rounded-xl border border-border bg-surface p-4 text-sm";
  if (state === "ios-install")
    return (
      <div className={box}>
        <div className="font-semibold">Get notifications on your iPhone</div>
        <p className="mt-1 text-muted">
          Tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>. Open the app from your Home Screen and turn on notifications here. Until then, we&apos;ll email you.
        </p>
      </div>
    );
  if (state === "unsupported") return <div className={box}>This browser can&apos;t receive notifications. We&apos;ll email you instead.</div>;
  if (state === "denied")
    return <div className={box}>Notifications are blocked for this site. Turn them on in your browser or phone settings. Until then, we&apos;ll email you.</div>;
  return (
    <div className={`${box} flex flex-wrap items-center justify-between gap-3`}>
      <div>
        <div className="font-semibold">{state === "on" ? "Notifications are on for this device" : "Turn on notifications"}</div>
        <p className="text-muted">{state === "on" ? "You'll get lesson reminders and quorum announcements here." : "Get lesson reminders and quorum announcements on this device."}</p>
      </div>
      {state === "on" ? (
        <button className="btn-secondary btn-sm" disabled={busy} onClick={disable}>
          Turn off
        </button>
      ) : (
        <button className="btn-primary btn-sm" disabled={busy} onClick={enable}>
          Turn on
        </button>
      )}
    </div>
  );
}
