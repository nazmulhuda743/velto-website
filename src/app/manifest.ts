import type { MetadataRoute } from "next";

/**
 * Installable app manifest (/manifest.webmanifest). The app opens the normal website: same
 * pages, same flows. Icons are the official Velto mark (public/icons, cut from
 * public/brand/velto-logo.png, never redrawn).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Velto Premium Laundry",
    short_name: "Velto",
    description: "Laundry, dry cleaning and ironing in Uttara with pickup from your door. Book a pickup, track an order and see your orders.",
    lang: "en",
    dir: "ltr",
    // Plain "/": a source parameter here would overwrite campaign attribution on every launch;
    // launches are measured with the app_launch event instead.
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      { name: "Book a Pickup", short_name: "Book", url: "/book?source=pwa_shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Track an Order", short_name: "Track", url: "/track?source=pwa_shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My Account", short_name: "Account", url: "/account", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
