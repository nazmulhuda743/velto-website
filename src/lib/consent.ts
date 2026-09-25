/**
 * Cookie consent contract, shared by the browser banner, the GTM bridge and
 * the server-side analytics ingestion (which re-checks the cookie).
 * Runtime-neutral: no browser or Node APIs at module level.
 *
 * Cookie `velto_consent_v1` holds only:
 *   { "version": 1, "analytics": bool, "marketing": bool, "timestamp": ISO }
 * No identifiers, no personal data.
 */

/** Bump when the categories or what they control change; visitors are asked again. */
export const CONSENT_POLICY_VERSION = 1;
export const CONSENT_COOKIE = "velto_consent_v1";
/** Six months, then the visitor is asked again. */
export const CONSENT_MAX_AGE_SECONDS = 182 * 24 * 60 * 60;

export type ConsentState = {
  version: number;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

export type ConsentChoice = Pick<ConsentState, "analytics" | "marketing">;

export type ConsentAction = "accept_all" | "reject_nonessential" | "preferences_saved";

export const ESSENTIAL_ONLY: ConsentChoice = { analytics: false, marketing: false };

/** Parse a raw (possibly URI-encoded) cookie value; anything unexpected or from another policy version is "no decision". */
export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw.startsWith("{") ? raw : decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.version !== CONSENT_POLICY_VERSION) return null;
  if (typeof v.analytics !== "boolean" || typeof v.marketing !== "boolean") return null;
  if (typeof v.timestamp !== "string" || Number.isNaN(Date.parse(v.timestamp))) return null;
  return { version: v.version, analytics: v.analytics, marketing: v.marketing, timestamp: v.timestamp };
}

export function serializeConsent(choice: ConsentChoice, now = new Date()): string {
  const state: ConsentState = {
    version: CONSENT_POLICY_VERSION,
    analytics: choice.analytics,
    marketing: choice.marketing,
    timestamp: now.toISOString(),
  };
  return encodeURIComponent(JSON.stringify(state));
}

/** Google Consent Mode v2 signals for a choice (GTM reads these; tags must honour them). */
export function consentModeSignals(choice: ConsentChoice) {
  const analytics = choice.analytics ? "granted" : "denied";
  const marketing = choice.marketing ? "granted" : "denied";
  return {
    analytics_storage: analytics,
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    functionality_storage: "granted",
    security_storage: "granted",
  } as const;
}
