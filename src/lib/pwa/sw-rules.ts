/**
 * The service worker's routing rules (served by app/sw.js/route.ts). Pure and self-contained:
 * the function body is inlined into the worker script, so it may not reference anything outside
 * itself. Unit-tested in tests/command-center/pwa.test.cjs.
 *
 * The worker is deliberately conservative: it only speeds up static files and gives an offline
 * page. Anything personal, live or state-changing always goes straight to the network.
 */

export type SwStrategy =
  /** Not handled by the worker at all (the browser does exactly what it does today). */
  | "passthrough"
  /** Content-hashed build files, brand art and icons: cache first, they never change. */
  | "static"
  /** Photos: show the cached copy at once, refresh it in the background (bounded cache). */
  | "image"
  /** Public page navigations: network first; offline → last copy of the page → /offline. */
  | "page"
  /** Personal or live pages (account, booking, sign-in): always the network, never stored; only
   *  when the network fails is the offline page shown instead of the browser's error screen. */
  | "live";

export type SwRequest = {
  method: string;
  url: string;
  mode: string;
  /** Lower-case header lookup. */
  header: (name: string) => string | null;
};

export function swStrategy(req: SwRequest, origin: string): SwStrategy {
  if (req.method !== "GET") return "passthrough";
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return "passthrough";
  }
  // Other sites (Supabase, Google Maps, tag manager, WhatsApp) are never touched.
  if (url.origin !== origin) return "passthrough";
  // React Server Component payloads, prefetches and server actions stay live.
  if (req.header("rsc") || req.header("next-router-prefetch") || req.header("next-action") || url.searchParams.has("_rsc")) return "passthrough";

  const path = url.pathname.replace(/^\/bn(?=\/|$)/, "") || "/";
  // Personal, live or state-changing areas: never cached, never answered from a cache.
  const NEVER = [
    "/api", "/admin", "/account", "/auth", "/login", "/signup", "/forgot-password", "/reset-password",
    "/book", "/quote", "/track", "/r", "/go", "/sw.js", "/manifest.webmanifest",
  ];
  if (NEVER.some((p) => path === p || path.startsWith(`${p}/`))) {
    const DATA = ["/api", "/go", "/sw.js", "/manifest.webmanifest"];
    const isData = DATA.some((p) => path === p || path.startsWith(`${p}/`));
    return !isData && req.mode === "navigate" ? "live" : "passthrough";
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")) return "static";
  if (url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/images/")) return "image";
  if (req.mode === "navigate" || (req.header("accept") ?? "").includes("text/html")) return "page";
  return "passthrough";
}

/**
 * Whether a response may be stored. Personal pages are excluded by path above; this is the second
 * lock: anything marked private or no-store, redirected, partial or failed is never kept.
 */
export function swCanStore(status: number, type: string, cacheControl: string | null): boolean {
  if (status !== 200 || (type !== "basic" && type !== "default")) return false;
  return !/\b(no-store|private)\b/i.test(cacheControl ?? "");
}
