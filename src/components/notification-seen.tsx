"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** When a page is opened from a notification (?n=<id>), marks it read and tidies the address. */
export function NotificationSeen() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const url = new URL(location.href);
    const id = Number(url.searchParams.get("n"));
    if (!id) return;
    url.searchParams.delete("n");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    fetch("/api/notifications/seen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
      .then(() => router.refresh())
      .catch(() => {});
  }, [path, router]);
  return null;
}
