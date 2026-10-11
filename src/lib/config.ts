/** Public base URL used in emails, e.g. https://villas-eq.example.com */
export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const isHttps = () => appUrl().startsWith("https://");
