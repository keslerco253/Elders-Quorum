"use client";

import { useEffect } from "react";
import { inApp } from "@/lib/native-app";

/**
 * In the phone app, links to our own pages that would open a new window (a flyer,
 * a plan's PDF) open right in the app instead. A new window would go to Safari's
 * viewer, which isn't signed in.
 */
export function AppLinks() {
  useEffect(() => {
    if (!inApp()) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[target=_blank]") as HTMLAnchorElement | null;
      if (!a || !a.href) return;
      const url = new URL(a.href, location.href);
      // Calendar files and subscriptions still go to the phone's calendar.
      if (url.origin !== location.origin || /\/calendar\/\d+\/ics|\/feed\//.test(url.pathname)) return;
      e.preventDefault();
      location.assign(url.href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
