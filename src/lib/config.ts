/**
 * Public base URL used in emails, e.g. https://mywardlink.net. "https://" is
 * added if the setting leaves it out.
 */
export function appUrl() {
  const raw = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "http://localhost:3000";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export const isHttps = () => appUrl().startsWith("https://");
