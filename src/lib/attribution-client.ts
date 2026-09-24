/**
 * Browser-side attribution capture built on the shared allowlist sanitizer in
 * src/lib/attribution.ts (Codex foundation). Storage is best-effort session
 * context only; every read re-sanitizes through readAttribution.
 */
import { ATTRIBUTION_KEYS, readAttribution, type Attribution } from "@/lib/attribution";

const STORAGE_KEY = "velto_attribution";

/** Store campaign context once per session, only when a campaign/click id is present. */
export function captureAttributionFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!ATTRIBUTION_KEYS.some((key) => params.get(key))) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
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

/** Acquisition context for a booking/quote submission: session campaign context plus the current URL's context. */
export function submissionAttribution(): Record<string, string> {
  const merged: Attribution = {
    ...storedAttribution(),
    ...readAttribution(new URLSearchParams(window.location.search)),
  };
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === "string") clean[key] = value;
  }
  return clean;
}
