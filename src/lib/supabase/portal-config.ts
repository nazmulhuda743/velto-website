import "server-only";

const trimSlash = (value: string) => value.replace(/\/+$/, "");

export function portalSupabaseConfig() {
  const url = process.env.VELTO_PORTAL_SUPABASE_URL?.trim();
  const key = process.env.VELTO_PORTAL_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url: trimSlash(url), key } : null;
}

export function portalSiteUrl(path = "/") {
  const explicit = process.env.VELTO_PORTAL_SITE_URL?.trim();
  const preview = process.env.VERCEL_ENV !== "production" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;
  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = trimSlash(explicit || preview || fallback || "http://localhost:3000");
  return new URL(path, `${base}/`).toString();
}

export function safePortalNext(value: string | null | undefined) {
  if (!value) return "/account";
  const allowed = new Set(["/account", "/account/orders", "/account/profile", "/reset-password", "/book"]);
  return allowed.has(value) ? value : "/account";
}
