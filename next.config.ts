import type { NextConfig } from "next";

// Form submissions are only accepted from the app's own address. Behind
// Tailscale Funnel or Cloudflare the proxy can change the Host header, so the
// public address is listed explicitly (APP_URL is passed in at build time).
const publicHost = (() => {
  try {
    const raw = process.env.APP_URL?.trim();
    return raw ? new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: ["*.ts.net", ...(publicHost ? [publicHost] : [])],
    },
  },
};

export default nextConfig;
