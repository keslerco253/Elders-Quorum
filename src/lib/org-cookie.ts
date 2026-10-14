/** Cookie holding the organization the member is looking at (no database here: middleware reads it). */
export const ORG_COOKIE = "eq_org";
export const orgCookieMaxAge = 365 * 24 * 3600;

/** Adds ?org=<id> to an app path, so opening it switches to that organization. */
export function withOrg(path: string, orgId: number | null | undefined): string {
  if (!orgId) return path;
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}org=${orgId}${hash ? `#${hash}` : ""}`;
}
