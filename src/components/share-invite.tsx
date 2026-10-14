"use client";

import { useState } from "react";

/** Opens the phone's share sheet (Messages, email, etc.), or copies the invite. */
export function ShareInvite({ text, link }: { text: string; link: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join our ward app", text, url: link });
        return;
      } catch {
        // Cancelled, or not allowed: fall back to copying.
      }
    }
    await navigator.clipboard.writeText(`${text} ${link}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <button type="button" onClick={share} className="btn-primary">
      {copied ? "Copied! Paste it in a text or email" : "Share the invite"}
    </button>
  );
}
