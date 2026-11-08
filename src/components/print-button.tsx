"use client";

import { useState } from "react";
import { appHandlesFiles, inApp, postToApp } from "@/lib/native-app";

/**
 * The page as one self-contained document for the phone app's print screen: what's in
 * `.print-sheet` (or the main area) without the parts marked no-print, with the app's
 * styles written into it (the print screen can't load them itself).
 */
async function printableHtml(): Promise<string> {
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
  const css = (await Promise.all(links.map((l) => fetch(l.href, { credentials: "same-origin" }).then((r) => (r.ok ? r.text() : "")).catch(() => "")))).join("\n");
  const inline = [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
  const sheet = (document.querySelector(".print-sheet") ?? document.querySelector("main") ?? document.body).cloneNode(true) as HTMLElement;
  sheet.querySelectorAll(".no-print, script, noscript").forEach((el) => el.remove());
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${location.origin}/"><title>${document.title}</title><style>${css}\n${inline}\nbody{background:#fff;color:#000;margin:0}</style></head><body>${sheet.outerHTML}</body></html>`;
}

/**
 * Prints the page (or saves it as a PDF from the print screen). In a browser it's the
 * browser's print screen; in the phone app, the phone's own (the app's browser can't
 * print by itself).
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [oldApp, setOldApp] = useState(false);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-primary btn-sm"
        disabled={busy}
        onClick={async () => {
          if (appHandlesFiles()) {
            setBusy(true);
            try {
              postToApp({ type: "print", html: await printableHtml() });
            } finally {
              setBusy(false);
            }
          } else if (inApp()) setOldApp(true);
          else window.print();
        }}
      >
        {busy ? "Getting it ready…" : `🖨 ${label}`}
      </button>
      {oldApp && <span className="max-w-xs text-right text-xs text-warn">This version of the app can&apos;t print. Update the app, or open mywardlink.net in your phone&apos;s browser or on a computer to print.</span>}
    </span>
  );
}
