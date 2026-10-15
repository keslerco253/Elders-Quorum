import Link from "next/link";

/**
 * A link that may open another organization (?org=...). Those load as a normal page
 * (no prefetching), so the switch happens only when the link is followed.
 */
export function OrgLink({ href, ...props }: { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  if (/[?&]org=/.test(href)) return <a href={href} {...props} />;
  return <Link href={href} {...props} />;
}
