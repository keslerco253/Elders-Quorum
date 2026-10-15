"use client";

import { useEffect, useRef, useState } from "react";

const FIRST_PAGES = 12;

/** Shows a PDF's pages right on the page (iPhones can't show more than the first page of an embedded PDF). */
export function PdfPages({ src, name }: { src: string; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
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
        const pdf = await loading.promise;
        if (cancelled) return;
        setCount(pdf.numPages);
        const el = box.current;
        if (!el) return;
        el.replaceChildren();
        const last = showAll ? pdf.numPages : Math.min(pdf.numPages, FIRST_PAGES);
        for (let n = 1; n <= last && !cancelled; n++) {
          const page = await pdf.getPage(n);
          const cssWidth = el.clientWidth || 600;
          const base = page.getViewport({ scale: 1 });
          const scale = (cssWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "plan-pdf-page";
          canvas.setAttribute("aria-label", `${name}, page ${n}`);
          el.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [src, name, showAll]);

  return (
    <div>
      {failed ? (
        <a href={src} target="_blank" rel="noreferrer" className="plan-file-card">
          📄 <span>{name}</span>
        </a>
      ) : (
        <div ref={box} className="space-y-3">
          <div className="plan-pdf-loading">Loading {name}…</div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        {!showAll && count > FIRST_PAGES && (
          <button type="button" className="link" onClick={() => setShowAll(true)}>
            Show all {count} pages
          </button>
        )}
        <a href={src} target="_blank" rel="noreferrer" className="link">
          Open the PDF
        </a>
      </div>
    </div>
  );
}
