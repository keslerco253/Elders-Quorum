"use client";

import { useEffect, useRef, useState } from "react";
import { isPicture } from "@/lib/upload-names";

/** A small preview of a flyer for lists: the picture, or the first page of a PDF. */
export function FlyerThumb({ file, name, big, src: given }: { file: string; name: string | null; big?: boolean; /** Where to load it from (default /files/<file>). */ src?: string }) {
  const src = given ?? `/files/${file}`;
  const box = `${big ? "h-24 w-24" : "h-14 w-14"} shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2`;
  if (isPicture(file)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name ?? "Flyer"} loading="lazy" className={`${box} object-cover`} />;
  }
  if (file.endsWith(".pdf")) return <PdfThumb src={src} className={box} width={big ? 96 : 56} />;
  // Other documents: their kind, at a glance.
  const ext = file.split(".").pop() ?? "";
  const kind = ext.startsWith("doc") ? ["📝", "Word"] : ext.startsWith("xls") || ext === "csv" ? ["📊", ext === "csv" ? "CSV" : "Excel"] : ext.startsWith("ppt") ? ["📽️", "PowerPoint"] : ["📄", ext.toUpperCase()];
  return (
    <span className={`${box} flex flex-col items-center justify-center gap-0.5`} aria-label={kind[1]}>
      <span className="text-2xl">{kind[0]}</span>
      {big && <span className="text-[10px] font-semibold text-muted uppercase">{kind[1]}</span>}
    </span>
  );
}

function PdfThumb({ src, className, width }: { src: string; className: string; width: number }) {
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
        const viewport = page.getViewport({ scale: (width * Math.min(window.devicePixelRatio || 1, 2)) / base.width });
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
  }, [src, width]);
  if (failed)
    return (
      <span className={`${className} flex items-center justify-center text-2xl`} aria-label="Flyer">
        📄
      </span>
    );
  return (
    <span className={`${className} block bg-white`}>
      <canvas ref={canvas} className="block w-full" aria-label="Flyer" />
    </span>
  );
}
