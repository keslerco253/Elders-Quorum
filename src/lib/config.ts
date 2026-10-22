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

/**
 * Where people write with questions about the app (Privacy and Terms pages):
 * CONTACT_EMAIL, or else the address the app sends email from.
 */
export function contactEmail() {
  return (process.env.CONTACT_EMAIL || process.env.SMTP_USER || "villaseldersquorum@gmail.com").trim();
}
