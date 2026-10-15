import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { publicAppName } from "@/lib/wards";
import { ServiceWorker } from "@/components/service-worker";
import { SearchableSelects } from "@/components/searchable-selects";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getUser();
  const name = user?.ward.name ?? publicAppName();
  return {
    title: { default: name, template: `%s · ${name}` },
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d3a5f" },
    { media: "(prefers-color-scheme: dark)", color: "#0e151d" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const theme = user?.theme && user.theme !== "system" ? user.theme : undefined;
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <ServiceWorker />
        <SearchableSelects />
      </body>
    </html>
  );
}
