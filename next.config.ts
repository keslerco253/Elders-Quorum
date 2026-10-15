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
  // Basic browser protections on every page: no framing by other sites (clickjacking),
  // no content-type guessing, HTTPS only, and no full addresses leaked to other sites.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
      allowedOrigins: ["*.ts.net", ...(publicHost ? [publicHost] : [])],
    },
  },
};

export default nextConfig;
