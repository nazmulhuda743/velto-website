/**
 * Browser-side attribution capture built on the shared allowlist sanitizer in
 * src/lib/attribution.ts (Codex foundation). Storage is best-effort session
 * context only; every read re-sanitizes through readAttribution.
 */
import { analyticsSessionId, currentDevice, readConsent } from "@/lib/analytics/client";
import { referrerHost } from "@/lib/analytics/classify";
import { ATTRIBUTION_KEYS, MARKETING_ATTRIBUTION_KEYS as MARKETING_KEYS, readAttribution, type Attribution } from "@/lib/attribution";

/** Drop advertising identifiers unless the visitor granted Marketing consent. */
export function consentedAttribution(attribution: Attribution): Attribution {
  if (readConsent()?.marketing) return attribution;
  const out = { ...attribution };
  for (const key of MARKETING_KEYS) delete out[key];
  return out;
}

const STORAGE_KEY = "velto_attribution";

/** Store campaign context once per session, only when a campaign/click id or an external referrer is present. */
export function captureAttributionFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const referrer = referrerHost(document.referrer, window.location.hostname);
    if (!ATTRIBUTION_KEYS.some((key) => params.get(key)) && !referrer) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    if (referrer) params.set("referrer", referrer);
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(readAttribution(params, window.location.pathname)),
    );
  } catch {
    /* storage unavailable — attribution is best-effort */
  }
}

export function storedAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, unknown>;
    const params = new URLSearchParams();
    let landing: string | undefined;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== "string") continue;
      if (key === "landing_page") landing = value;
      else params.set(key, value);
    }
    return readAttribution(params, landing);
  } catch {
    return {};
  }
}

/**
 * Acquisition context for a booking/quote submission: session campaign
 * context plus the current URL's context, filtered by consent. It also names
 * the consent state (so future Meta CAPI can honour it), the coarse device
 * class, and — only with Analytics consent — the anonymous analytics session.
 */
export function submissionAttribution(): Record<string, string> {
  const consent = readConsent();
  const merged: Attribution = {
    ...consentedAttribution({
      ...storedAttribution(),
      ...readAttribution(new URLSearchParams(window.location.search)),
    }),
    device: currentDevice(),
    consent: consent ? [consent.analytics && "analytics", consent.marketing && "marketing"].filter(Boolean).join("+") || "essential" : "none",
    analytics_session: analyticsSessionId(),
  };
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === "string") clean[key] = value;
  }
  return clean;
}
