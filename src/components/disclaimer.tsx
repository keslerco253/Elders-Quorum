/** Shown in small print at the bottom of every page. */
export const DISCLAIMER_TEXT = "mywardlink.net is not an official program of The Church of Jesus Christ of Latter-day Saints.";

export function Disclaimer({ className = "" }: { className?: string }) {
  return <p className={`text-center text-[11px] leading-snug text-muted ${className}`}>{DISCLAIMER_TEXT}</p>;
}
