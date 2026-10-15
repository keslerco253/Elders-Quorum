"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * A tab or app left open keeps showing what it loaded (the organization menu,
 * counts, lists). When someone comes back to it, fetch the current version,
 * so it matches what they see on their other devices.
 */
export function StayFresh() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return null;
}
