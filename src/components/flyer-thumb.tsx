"use client";

import { useEffect, useRef, useState } from "react";
import { isPicture } from "@/lib/upload-names";

/** A small preview of a flyer for lists: the picture, or the first page of a PDF. */
export function FlyerThumb({ file, name }: { file: string; name: string | null }) {
  const src = `/files/${file}`;
  const box = "h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2";
  if (isPicture(file)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? "Flyer"} loading="lazy" className={`${box} object-cover`} />;
  }
  if (file.endsWith(".pdf")) return <PdfThumb src={src} className={box} />;
  return (
    <span className={`${box} flex items-center justify-center text-2xl`} aria-label="Flyer">
      📄
    </span>
  );
}

function PdfThumb({ src, className }: { src: string; className: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loading = pdfjs.getDocument({ url: src, withCredentials: true });
        task = loading;
        const page = await (await loading.promise).getPage(1);
        const el = canvas.current;
        if (cancelled || !el) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (56 * Math.min(window.devicePixelRatio || 1, 2)) / base.width });
        el.width = Math.floor(viewport.width);
        el.height = Math.floor(viewport.height);
        await page.render({ canvas: el, viewport }).promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [src]);
  if (failed)
    return (
      <span className={`${className} flex items-center justify-center text-2xl`} aria-label="Flyer">
        📄
      </span>
    );
  return (
    <span className={`${className} bg-white`}>
      <canvas ref={canvas} className="block w-full" aria-label="Flyer" />
    </span>
  );
}
