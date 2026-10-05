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
    // The installed app is everything under /app/ (its own pages and layout; the website never loads
    // there). It opens on the app's Home (signed out: the app's sign-in). No source parameter: it would
    // overwrite campaign attribution; launches are measured with app_launch.
    start_url: "/app/home",
    scope: "/app/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["lifestyle", "shopping"],
    // Lets Chrome tell the website that this app is already installed (navigator.getInstalledRelatedApps),
    // so the install popup is never shown to someone who has it.
    related_applications: [{ platform: "webapp", url: "https://www.velto.com.bd/manifest.webmanifest" }],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      { name: "Book a Pickup", short_name: "Book", url: "/app/book", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My Orders", short_name: "Orders", url: "/app/orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
