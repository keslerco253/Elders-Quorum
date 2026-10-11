import type { MetadataRoute } from "next";
import { publicAppName } from "@/lib/wards";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  const name = publicAppName();
  return {
    name,
    short_name: name.length > 14 ? "Elders Quorum" : name,
    description: "Lessons, calendar, plans and announcements for our elders quorum.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#1d3a5f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
