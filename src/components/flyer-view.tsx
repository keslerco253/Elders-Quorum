import { isPicture } from "@/lib/upload-names";
import { PdfPages } from "./pdf-pages";

/** A flyer shown in full on a page: the picture, a PDF's pages, or a link for other files. */
export function FlyerView({ file, name, className = "card mb-4", src = `/files/${file}` }: { file: string; name: string | null; className?: string; src?: string }) {
  return (
    <div className={className}>
      {isPicture(file) ? (
        <>
          <a href={src} target="_blank" rel="noreferrer" title="Open the picture">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={name ?? "Flyer"} className="mx-auto block max-h-[80vh] w-auto max-w-full rounded-lg" />
          </a>
          <div className="mt-2 text-center text-sm">
            <a href={src} target="_blank" rel="noreferrer" className="link">
              Open the picture
            </a>
          </div>
        </>
      ) : file.endsWith(".pdf") ? (
        <PdfPages src={src} name={name ?? "Flyer"} />
      ) : (
        <a href={src} target="_blank" rel="noreferrer" className="plan-file-card">
          📄 <span>{name}</span>
        </a>
      )}
    </div>
  );
}
