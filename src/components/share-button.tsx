"use client";

import { useEffect, useState } from "react";
import { inApp, shareLink } from "@/lib/native-app";

/** "Share…": the phone's share sheet (in the app, or a phone browser). Hidden where there's no share sheet. */
export function ShareButton({ url, title, text, label = "Share…", className = "btn-secondary btn-sm" }: { url: string; title?: string; text?: string; label?: string; className?: string }) {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(inApp() || typeof navigator.share === "function"), []);
  if (!can) return null;
  return (
    <button type="button" className={className} onClick={() => shareLink({ url, title, text })}>
      {label}
    </button>
  );
}
