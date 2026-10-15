/**
 * Cookie holding the organization this device switched to, and when:
 * "<org id>:<ms>". The newest switch on any device wins (see members.last_org_at).
 * No database here: middleware sets it.
 */
export const ORG_COOKIE = "eq_org";
export const orgCookieMaxAge = 365 * 24 * 3600;

export const orgCookieValue = (orgId: number | string, at = Date.now()) => `${orgId}:${at}`;

/** Reads the cookie (also the older plain "<org id>" form, as if from long ago). */
export function parseOrgCookie(v: string | undefined): { orgId: number; at: number } | undefined {
  const m = v?.match(/^(\d+)(?::(\d+))?$/);
  return m ? { orgId: Number(m[1]), at: Number(m[2] ?? 0) } : undefined;
}

/** Adds ?org=<id> to an app path, so opening it switches to that organization. */
export function withOrg(path: string, orgId: number | null | undefined): string {
  if (!orgId) return path;
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}org=${orgId}${hash ? `#${hash}` : ""}`;
}
