/**
 * Browser-only consent + first-party analytics runtime.
 *
 * Nothing behavioral leaves the browser unless the visitor granted the
 * Analytics category. Identifiers are random UUIDs: a first-party visitor
 * cookie (created only after analytics consent) and a per-tab session with a
 * 30-minute inactivity window. No names, phones, form values or keystrokes.
 */
import { storedAttribution } from "@/lib/attribution-client";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_POLICY_VERSION,
  consentModeSignals,
  parseConsent,
  serializeConsent,
  type ConsentAction,
  type ConsentChoice,
  type ConsentState,
  ESSENTIAL_ONLY,
} from "@/lib/consent";
import { deviceFromWidth, referrerHost, type Device } from "./classify";
import { CONSENT_EVENTS } from "./events";

export const CONSENT_CHANGE_EVENT = "velto:consent";
export const CONSENT_OPEN_EVENT = "velto:consent-open";

const VISITOR_COOKIE = "velto_vid";
const VISITOR_MAX_AGE_SECONDS = 395 * 24 * 60 * 60; // 13 months
const SESSION_KEY = "velto_session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Cookies set by GA4 / Meta through GTM on this domain; removed when consent is withdrawn. */
const ANALYTICS_COOKIES = /^(_ga|_ga_[A-Z0-9]+|_gid|_gat.*)$/;
const MARKETING_COOKIES = /^(_fbp|_fbc|_gcl_au|_gcl_aw|_gcl_dc)$/;

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/* ---------------------------------------------------------------- cookies */

function readCookie(name: string): string | undefined {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : undefined;
  } catch {
    return undefined;
  }
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function expireCookie(name: string) {
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const domain of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
  }
}

function clearCookies(pattern: RegExp) {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=", 1)[0];
    if (name && pattern.test(name)) expireCookie(name);
  }
}

/* ---------------------------------------------------------------- consent */

export function readConsent(): ConsentState | null {
  return parseConsent(readCookie(CONSENT_COOKIE));
}

export const currentDevice = (): Device => deviceFromWidth(window.innerWidth);

/** Tell GTM (Consent Mode v2 + a dataLayer event) what the visitor allowed. */
export function pushConsentToTagManager(choice: ConsentChoice, mode: "default" | "update") {
  window.dataLayer ??= [];
  window.gtag ??= function gtag() {
    // gtag() must push the arguments object itself, as Google's snippet does.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", mode, consentModeSignals(choice));
  window.dataLayer.push({
    event: "velto_consent",
    velto_consent_analytics: choice.analytics,
    velto_consent_marketing: choice.marketing,
    velto_consent_version: CONSENT_POLICY_VERSION,
  });
}

export function saveConsent(choice: ConsentChoice, action: ConsentAction) {
  const previous = readConsent();
  writeCookie(CONSENT_COOKIE, serializeConsent(choice), CONSENT_MAX_AGE_SECONDS);

  if (!choice.analytics) {
    expireCookie(VISITOR_COOKIE);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    clearCookies(ANALYTICS_COOKIES);
  }
  if (!choice.marketing) clearCookies(MARKETING_COOKIES);

  pushConsentToTagManager(choice, "update");
  sendConsentEvent(action, choice);
  window.dataLayer?.push({ event: `consent_${action}` });
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: { choice, previous } }));
}

export function openConsentPreferences() {
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}

/* ------------------------------------------------------------- transport */

function post(body: unknown) {
  try {
    void fetch("/api/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    /* analytics is best-effort */
  }
}

/** Anonymous consent outcome (no visitor or session id), used for consent rates. */
export function sendConsentEvent(action: ConsentAction | "banner_view", choice?: ConsentChoice) {
  post({
    type: "consent",
    action,
    analytics: choice?.analytics ?? false,
    marketing: choice?.marketing ?? false,
    version: CONSENT_POLICY_VERSION,
    device: currentDevice(),
  });
}

export function reportNotFound(path: string) {
  post({ type: "not_found", path });
}

/* ------------------------------------------------------------- identity */

type Session = { id: string; last: number; isNew: boolean; referrer?: string };

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      );

function identity(): { visitorId: string; session: Session } | null {
  try {
    let visitorId = readCookie(VISITOR_COOKIE);
    let created = false;
    if (!visitorId || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
      visitorId = uuid();
      created = true;
    }
    // Refresh the rolling expiry on every visit.
    writeCookie(VISITOR_COOKIE, visitorId, VISITOR_MAX_AGE_SECONDS);

    const now = Date.now();
    let session: Session | null = null;
    try {
      session = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    } catch {
      session = null;
    }
    if (!session || typeof session.id !== "string" || now - session.last > SESSION_IDLE_MS) {
      session = { id: uuid(), last: now, isNew: created, referrer: referrerHost(document.referrer, window.location.hostname) };
    }
    session.last = now;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { visitorId, session };
  } catch {
    return null;
  }
}

/** The anonymous analytics session id, only while analytics consent is granted. */
export function analyticsSessionId(): string | undefined {
  if (!readConsent()?.analytics) return undefined;
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    return session?.id;
  } catch {
    return undefined;
  }
}

/* --------------------------------------------------------------- events */

type Queued = { event: string; path: string; service?: string; placement?: string; detail?: string };
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
const CONSENT_EVENT_SET = new Set<string>(CONSENT_EVENTS);

function flush() {
  timer = undefined;
  const events = queue;
  queue = [];
  if (!events.length || !readConsent()?.analytics) return;
  const id = identity();
  if (!id) return;
  const a = storedAttribution();
  post({
    type: "events",
    visitorId: id.visitorId,
    sessionId: id.session.id,
    isNew: id.session.isNew,
    device: currentDevice(),
    attribution: {
      landing_page: a.landing_page,
      referrer_host: id.session.referrer ?? a.referrer,
      // Only real UTM fields: on-site `?source=` values name CTA placements, not acquisition.
      utm_source: a.utm_source,
      utm_medium: a.utm_medium,
      utm_campaign: a.utm_campaign,
      utm_content: a.utm_content,
      utm_term: a.utm_term,
      click_id: a.gclid ? "gclid" : a.fbclid ? "fbclid" : undefined,
    },
    events,
  });
}

/** Queue a first-party event. Dropped silently without analytics consent. */
export function sendAnalyticsEvent(event: string, context: Record<string, string | undefined> = {}) {
  if (CONSENT_EVENT_SET.has(event) || !readConsent()?.analytics) return;
  queue.push({
    event,
    path: window.location.pathname,
    service: context.service,
    placement: context.placement,
    detail: context.item ?? context.detail,
  });
  if (queue.length >= 10) flush();
  else timer ??= setTimeout(flush, 800);
}

if (typeof window !== "undefined") {
  // Consent Mode default must be the first data-layer entry, ahead of any event.
  pushConsentToTagManager(readConsent() ?? ESSENTIAL_ONLY, "default");
  window.addEventListener("pagehide", () => {
    if (timer) clearTimeout(timer);
    flush();
  });
}
