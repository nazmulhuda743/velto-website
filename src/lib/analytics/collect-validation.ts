/**
 * Validation for /api/collect. Runtime-neutral so it is unit-tested with the
 * foundation-style compile (tests/command-center).
 *
 * Privacy rules enforced here, not just in the client:
 * - paths are pathnames only (query strings and fragments are dropped, long
 *   digit runs and email-like segments redacted);
 * - free text is never accepted: detail/service/placement are slugs;
 * - campaign values that look like an email or phone number are discarded;
 * - click ids are recorded as presence ("fbclid" / "gclid"), never the value.
 */
import { CONSENT_EVENTS, isAnalyticsEvent, type AnalyticsEvent } from "./events";
import { isDevice, type Device } from "./classify";
import { isPrivatePath, redactPrivatePath } from "./private-paths";

export const MAX_EVENTS_PER_BATCH = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const HOST = /^[a-z0-9.-]{1,120}$/;

export type CleanEvent = {
  event: AnalyticsEvent;
  path: string;
  service: string | null;
  placement: string | null;
  detail: string | null;
};

export type CleanAttribution = {
  landing_page: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  click_id: "fbclid" | "gclid" | null;
};

export type CollectBody =
  | {
      type: "events";
      visitorId: string;
      sessionId: string;
      isNew: boolean;
      device: Device;
      attribution: CleanAttribution;
      events: CleanEvent[];
    }
  | {
      type: "consent";
      action: "banner_view" | "accept_all" | "reject_nonessential" | "preferences_saved";
      analytics: boolean;
      marketing: boolean;
      version: number;
      device: Device;
    }
  | { type: "not_found"; path: string };

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** An on-site pathname, without query or fragment. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/, 1)[0].trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 300) return null;
  if (/[\u0000-\u001f\u007f\s<>"']/.test(path)) return null;
  // A mistyped URL could carry a phone or order number: redact long digit runs and emails.
  return redactPrivatePath(path).replace(/\d{6,}/g, "#").replace(/[^/]*@[^/]*/g, "#");
}

const slug = (v: unknown) => (typeof v === "string" && SLUG.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null);

/** Campaign text: short, printable, and not something that looks like personal data. */
export function cleanCampaignValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const value = v.trim().slice(0, 120);
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/@/.test(value) || /\d[\d\s-]{6,}\d/.test(value)) return null;
  return value;
}

function cleanAttribution(v: unknown): CleanAttribution {
  const a = rec(v);
  const host = typeof a.referrer_host === "string" ? a.referrer_host.trim().toLowerCase() : "";
  return {
    landing_page: cleanPath(a.landing_page),
    referrer_host: HOST.test(host) ? host : null,
    utm_source: cleanCampaignValue(a.utm_source),
    utm_medium: cleanCampaignValue(a.utm_medium),
    utm_campaign: cleanCampaignValue(a.utm_campaign),
    utm_content: cleanCampaignValue(a.utm_content),
    utm_term: cleanCampaignValue(a.utm_term),
    click_id: a.click_id === "fbclid" || a.click_id === "gclid" ? a.click_id : null,
  };
}

const CONSENT_ACTIONS = new Set(["banner_view", "accept_all", "reject_nonessential", "preferences_saved"]);
const CONSENT_EVENT_SET = new Set<string>(CONSENT_EVENTS);

export function validateCollectBody(input: unknown): CollectBody | null {
  const body = rec(input);

  if (body.type === "not_found") {
    const path = cleanPath(body.path);
    return path ? { type: "not_found", path } : null;
  }

  if (body.type === "consent") {
    if (typeof body.action !== "string" || !CONSENT_ACTIONS.has(body.action)) return null;
    const version = Number(body.version);
    if (!Number.isInteger(version) || version < 1 || version > 999 || !isDevice(body.device)) return null;
    const banner = body.action === "banner_view";
    return {
      type: "consent",
      action: body.action as "banner_view",
      analytics: !banner && body.analytics === true,
      marketing: !banner && body.marketing === true,
      version,
      device: body.device,
    };
  }

  if (body.type === "events") {
    if (typeof body.visitorId !== "string" || !UUID.test(body.visitorId)) return null;
    if (typeof body.sessionId !== "string" || !UUID.test(body.sessionId)) return null;
    if (!isDevice(body.device) || !Array.isArray(body.events)) return null;
    const events: CleanEvent[] = [];
    for (const raw of body.events.slice(0, MAX_EVENTS_PER_BATCH)) {
      const e = rec(raw);
      if (typeof e.event !== "string" || !isAnalyticsEvent(e.event) || CONSENT_EVENT_SET.has(e.event)) continue;
      const path = cleanPath(e.path);
      // Customer-account pages are never part of behavioral analytics.
      if (!path || isPrivatePath(path)) continue;
      events.push({ event: e.event, path, service: slug(e.service), placement: slug(e.placement), detail: slug(e.detail) });
    }
    if (!events.length) return null;
    return {
      type: "events",
      visitorId: body.visitorId.toLowerCase(),
      sessionId: body.sessionId.toLowerCase(),
      isNew: body.isNew === true,
      device: body.device,
      attribution: cleanAttribution(body.attribution),
      events,
    };
  }

  return null;
}
