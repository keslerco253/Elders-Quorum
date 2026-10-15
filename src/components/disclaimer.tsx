/** Shown in small print at the bottom of every page. */
export const DISCLAIMER_TEXT =
  "My Ward Link is an independent app run by volunteers. It is not an official website or app of The Church of Jesus Christ of Latter-day Saints, and is not affiliated with or endorsed by the Church.";

export function Disclaimer({ className = "" }: { className?: string }) {
  return <p className={`text-center text-[11px] leading-snug text-muted ${className}`}>{DISCLAIMER_TEXT}</p>;
}
