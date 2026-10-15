"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps an open conversation or inbox current, like a chat app: checks for new messages while it's on screen. */
export function LiveRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
