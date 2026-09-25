import "server-only";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { IMAGE_SLOTS } from "@/content/mock";
import { SEO_ROUTES } from "@/content/seo-routes";
import { isAnalyticsWritesEnabled } from "../analytics/store";
import { getOpsGateway } from "../integrations/ops/server";
import { isPricingConfigured } from "../integrations/pricing/server";
import { configuredGtmId } from "../gtm";
import { getSiteContent } from "../site-content";
import { SITE_URL as METADATA_ORIGIN } from "../site-url";
import { SITE_URL as SEO_ORIGIN } from "../seo/site";
import { isSupabaseConfigured, supabaseFetch } from "../supabase-server";
import { getAnalyticsHealth, getServerEvents, type ServerEvent } from "./analytics-data";
import { isAdminPreview } from "./preview";

export const PRODUCTION_ORIGIN = "https://www.velto.com.bd";
const CHECK_TIMEOUT_MS = 4_000;

export type HealthStatus = "healthy" | "warning" | "error";
export type HealthCheck = { id: string; group: string; label: string; status: HealthStatus; detail: string };

async function probe(path: string): Promise<{ ok: boolean; status: number; body?: unknown }> {
  try {
    const res = await supabaseFetch(path, { cache: "no-store", signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0 };
  }
}

const recent = (events: ServerEvent[], kind: string, hours = 24) =>
  events.filter((e) => e.kind === kind && Date.now() - Date.parse(e.occurred_at) < hours * 3_600_000).length;

const hoursSince = (iso: string | null | undefined) => (iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : null);

/** Live checks for /admin/health. Never throws; details never contain secrets or raw errors. */
export async function runHealthChecks(): Promise<HealthCheck[]> {
  const preview = isAdminPreview();
  const configured = isSupabaseConfigured() && !preview;
  const view = process.env.VELTO_PRICING_VIEW || "website_pricing_public";

  const [rest, content, pricingView, bucket, serverEvents, analytics] = await Promise.all([
    configured ? probe("/rest/v1/") : null,
    configured ? probe("/rest/v1/website_content?select=key&limit=5") : null,
    configured && isPricingConfigured() ? probe(`/rest/v1/${view}?select=item_slug&limit=1`) : null,
    configured ? probe("/storage/v1/bucket/website-media") : null,
    getServerEvents(1),
    getAnalyticsHealth(),
  ]);
  const events = serverEvents.state === "ok" ? serverEvents.data : [];
  const checks: HealthCheck[] = [];
  const add = (c: HealthCheck) => checks.push(c);

  // --- Data
  if (preview) {
    add({ id: "supabase", group: "Data", label: "Supabase connectivity", status: "warning", detail: "Local preview: no database is connected." });
  } else if (!isSupabaseConfigured()) {
    add({ id: "supabase", group: "Data", label: "Supabase connectivity", status: "error", detail: "VELTO_SUPABASE_URL / VELTO_SUPABASE_SECRET_KEY are not set on the server." });
  } else {
    const up = rest && rest.status > 0 && rest.status < 500;
    add({ id: "supabase", group: "Data", label: "Supabase connectivity", status: up ? "healthy" : "error", detail: up ? "The database answered." : "The database did not answer." });
  }

  if (content) {
    add({
      id: "content_store",
      group: "Data",
      label: "Website content store",
      status: content.ok ? "healthy" : "error",
      detail: content.ok ? `${Array.isArray(content.body) ? content.body.length : 0} content documents saved.` : "website_content could not be read; the site is using its built-in defaults.",
    });
  }

  if (!isPricingConfigured() || preview) {
    add({ id: "pricing_source", group: "Data", label: "Public pricing source", status: "warning", detail: "Not connected: the website shows its marked sample prices." });
  } else if (pricingView) {
    const rows = Array.isArray(pricingView.body) ? pricingView.body.length : 0;
    add({
      id: "pricing_source",
      group: "Data",
      label: "Public pricing source",
      status: pricingView.ok && rows > 0 ? "healthy" : "error",
      detail: pricingView.ok ? (rows > 0 ? `${view} is readable.` : `${view} returned no prices.`) : `${view} could not be read.`,
    });
  }

  if (bucket) {
    const isPublic = (bucket.body as { public?: boolean } | undefined)?.public === true;
    add({
      id: "media_storage",
      group: "Data",
      label: "Media storage",
      status: bucket.ok ? (isPublic ? "healthy" : "warning") : "error",
      detail: bucket.ok ? (isPublic ? "website-media bucket is available." : "website-media exists but is not public; uploaded photos would not display.") : "website-media bucket is missing or unreadable; image uploads will fail.",
    });
  }

  // --- APIs
  const pricingErrors = recent(events, "pricing_error");
  add({
    id: "pricing_api",
    group: "APIs",
    label: "Pricing API",
    status: pricingErrors > 3 ? "error" : pricingErrors > 0 || !isPricingConfigured() ? "warning" : "healthy",
    detail: `${isPricingConfigured() && !preview ? "Live prices." : "Sample prices (not connected)."} ${pricingErrors} failure${pricingErrors === 1 ? "" : "s"} in 24 h.`,
  });
  for (const [id, label, kind] of [["booking_api", "Booking API", "booking_error"], ["quote_api", "Quote API", "quote_error"]] as const) {
    const errors = recent(events, kind);
    const on = getOpsGateway() !== null;
    add({
      id,
      group: "APIs",
      label,
      status: errors > 0 ? "error" : on ? "healthy" : "warning",
      detail: `${on ? "Writes to Velto Ops are on." : "Writes to Velto Ops are off (VELTO_OPS_WRITES_ENABLED); customers see the “not switched on yet” message."} ${errors} failure${errors === 1 ? "" : "s"} in 24 h.`,
    });
  }
  const trackingErrors = recent(events, "tracking_error");
  add({
    id: "tracking_api",
    group: "APIs",
    label: "Order tracking API",
    status: !isSupabaseConfigured() ? "error" : trackingErrors > 0 ? "warning" : "healthy",
    detail: !isSupabaseConfigured() ? "Tracking needs the server Supabase configuration." : "Configured. Tracking requests are checked against Velto Ops on demand.",
  });

  // --- Search & domain
  const canonicalOk = METADATA_ORIGIN === PRODUCTION_ORIGIN && SEO_ORIGIN === PRODUCTION_ORIGIN;
  add({
    id: "canonical",
    group: "Search",
    label: "Canonical domain",
    status: canonicalOk ? "healthy" : "warning",
    detail: canonicalOk ? `Canonical URLs use ${PRODUCTION_ORIGIN}.` : `Canonical URLs use ${METADATA_ORIGIN}, not ${PRODUCTION_ORIGIN}. Set NEXT_PUBLIC_SITE_URL.`,
  });
  try {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const blocksAll = rules.some((rule) => rule.disallow === "/" || (Array.isArray(rule.disallow) && rule.disallow.includes("/")));
    const blocksApi = rules.some((rule) => [rule.disallow].flat().includes("/api/"));
    add({
      id: "robots",
      group: "Search",
      label: "robots.txt",
      status: blocksAll ? (process.env.VERCEL_ENV === "production" ? "error" : "warning") : blocksApi ? "healthy" : "warning",
      detail: blocksAll ? "Search engines are blocked (expected on preview deployments only)." : blocksApi ? "Public pages allowed; /api/ and /admin disallowed." : "robots.txt does not disallow /api/.",
    });
  } catch {
    add({ id: "robots", group: "Search", label: "robots.txt", status: "error", detail: "robots.txt could not be generated." });
  }
  try {
    const urls = sitemap();
    const foreign = urls.filter((u) => !u.url.startsWith(PRODUCTION_ORIGIN)).length;
    add({
      id: "sitemap",
      group: "Search",
      label: "sitemap.xml",
      status: urls.length === 0 ? "error" : foreign ? "warning" : "healthy",
      detail: foreign ? `${foreign} of ${urls.length} URLs are not on ${PRODUCTION_ORIGIN}.` : `${urls.length} search-facing pages listed.`,
    });
  } catch {
    add({ id: "sitemap", group: "Search", label: "sitemap.xml", status: "error", detail: "sitemap.xml could not be generated." });
  }

  // --- Security & measurement
  const sessionSecret = process.env.ADMIN_SESSION_SECRET ?? "";
  add({
    id: "admin_auth",
    group: "Security",
    label: "Admin sign-in",
    status: sessionSecret.length >= 32 ? "healthy" : "warning",
    detail: sessionSecret.length >= 32 ? "Sessions are signed with a dedicated secret; admins are re-checked against Ops on every request." : "ADMIN_SESSION_SECRET is not set (or shorter than 32 characters); sessions fall back to a key derived from the service key.",
  });
  add({
    id: "gtm",
    group: "Measurement",
    label: "Google Tag Manager",
    status: configuredGtmId() ? "healthy" : "warning",
    detail: configuredGtmId() ? "Container configured; it loads only after Analytics or Marketing consent." : "NEXT_PUBLIC_GTM_ID is missing, so GA4 and Meta Pixel cannot run.",
  });
  const lastEvent = analytics.state === "ok" ? hoursSince(analytics.data.last_event_at) : null;
  add({
    id: "ingestion",
    group: "Measurement",
    label: "First-party analytics ingestion",
    status: !isAnalyticsWritesEnabled() && !preview ? "warning" : lastEvent === null ? "warning" : lastEvent > 6 ? "warning" : "healthy",
    detail: !isAnalyticsWritesEnabled() && !preview
      ? "Switched off (WEBSITE_ANALYTICS_WRITES_ENABLED); no visitor events are stored."
      : lastEvent === null
        ? "No events received yet."
        : lastEvent > 6
          ? `No event received for ${Math.round(lastEvent)} hours.`
          : "Receiving events.",
  });

  return checks;
}

/** Content configuration issues worth fixing (SEO, images). */
export async function contentIssues() {
  const { seo, images } = await getSiteContent();
  const noindexed = SEO_ROUTES.filter((r) => seo[r.path]?.noindex);
  const missingDescription = SEO_ROUTES.filter((r) => !(seo[r.path]?.description ?? r.description));
  const missingImages = IMAGE_SLOTS.filter((s) => !images[s.id] && !s.slot.src);
  const stockImages = IMAGE_SLOTS.filter((s) => !images[s.id] && s.slot.src);
  const missingAlt = IMAGE_SLOTS.filter((s) => !(images[s.id]?.alt ?? s.slot.alt)?.trim());
  return { noindexed, missingDescription, missingImages, stockImages, missingAlt };
}
