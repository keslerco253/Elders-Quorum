"use client";

import { useEffect, useState } from "react";
import { inApp } from "@/lib/native-app";

/**
 * On a phone's browser (not in the app): a button that opens this page in the My Ward
 * Link app instead, for someone who has it and is signed in there. Links in texts can
 * land in the browser when the phone doesn't hand them to the app.
 */
export function OpenInApp({ path }: { path: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!inApp() && /iPhone|iPad|Android/i.test(navigator.userAgent));
  }, []);
  if (!show) return null;
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return (
    <a href={`mywardlink://open?path=${encodeURIComponent(safe)}`} className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
      <span>
        <span className="block font-semibold">Have the My Ward Link app?</span>
        Open this in the app, where you&apos;re already signed in.
      </span>
      <span className="btn-primary btn-sm shrink-0">Open the app</span>
    </a>
  );
}
