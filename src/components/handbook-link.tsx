import { handbookUrl, type HandbookChapter } from "@/lib/handbook";

/** "📘 General Handbook 8: Elders Quorum ↗": opens that chapter on the Church's site. */
export function HandbookLink({ chapter, className = "" }: { chapter: HandbookChapter; className?: string }) {
  return (
    <a
      href={handbookUrl(chapter)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-accent hover:bg-surface-2 ${className}`}
    >
      <span aria-hidden>📘</span>
      General Handbook {chapter.number}: {chapter.title}
      <span aria-hidden>↗</span>
    </a>
  );
}

/** One or more handbook links in a row, under a page's header. */
export function HandbookLinks({ chapters }: { chapters: (HandbookChapter | undefined)[] }) {
  const list = chapters.filter((c): c is HandbookChapter => !!c);
  if (!list.length) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {list.map((c) => (
        <HandbookLink key={c.number} chapter={c} />
      ))}
    </div>
  );
}
