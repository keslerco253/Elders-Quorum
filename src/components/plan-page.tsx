import { renderMarkdown } from "@/lib/markdown";
import { isPicture } from "@/lib/upload-names";
import { mediaProps, sizeClass, type Block, type MediaBlock } from "@/lib/plan-blocks";
import { PdfPages } from "./pdf-pages";

/** A plan page as members see it. `fileSrc` says where its pictures and PDFs load from (a public link uses its own). */
export function PlanPage({ blocks, fileSrc }: { blocks: Block[]; fileSrc?: (file: string) => string }) {
  return (
    <div className="plan-page">
      {blocks.map((b) => {
        switch (b.type) {
          case "heading":
            return b.text ? (
              <h2 key={b.id} className={sizeClass(b.size)}>
                {b.text}
              </h2>
            ) : null;
          case "text":
            return <div key={b.id} className={`prose-eq ${sizeClass(b.size)}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(b.text) }} />;
          case "divider":
            return <hr key={b.id} />;
          case "image":
          case "pdf":
            return (
              <figure key={b.id} {...mediaProps(b)}>
                <Media block={b} src={fileSrc?.(b.file)} />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            );
        }
      })}
    </div>
  );
}

export function Media({ block: b, src = `/files/${b.file}` }: { block: MediaBlock; src?: string }) {
  if (b.type === "image" && isPicture(b.file)) {
    // Tap the picture (or the link under it) to open it full size, like a PDF.
    return (
      <>
        <a href={src} target="_blank" rel="noreferrer" title="Open the picture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={b.caption || b.name} loading="lazy" />
        </a>
        <a href={src} target="_blank" rel="noreferrer" className="plan-open link">
          Open the picture
        </a>
      </>
    );
  }
  if (b.type === "pdf" && b.pages && b.file.endsWith(".pdf")) return <PdfPages src={src} name={b.name} />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="plan-file-card">
      📄 <span>{b.name}</span>
    </a>
  );
}
