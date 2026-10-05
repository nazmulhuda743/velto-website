"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { sendAnalyticsEvent } from "@/lib/analytics/client";
import { allowedOnPrivatePath, isAnalyticsEvent } from "@/lib/analytics/events";
import { isPrivatePath } from "@/lib/analytics/private-paths";
import { appendAttribution } from "@/lib/attribution";
import { captureAttributionFromUrl, consentedAttribution, storedAttribution, submissionAttribution } from "@/lib/attribution-client";

type Payload = Record<string, string | undefined>;

/**
 * Customer-account pages emit nothing: no data-layer entry, no first-party event, except the few
 * PRIVATE_PATH_EVENTS (app launches, the install card), which go to first-party analytics only.
 *
 * Emits approved UI events into one browser-side data layer. GTM can consume
 * these events when configured, while the custom event remains available to
 * local QA without requiring a production analytics ID. The same event goes to
 * Velto's first-party analytics, which drops it unless Analytics consent was
 * granted (GTM itself is not loaded before consent).
 */
export function track(event: string, context: Payload = {}) {
  if (process.env.NODE_ENV !== "production" && !isAnalyticsEvent(event)) {
    console.warn(`[analytics] "${event}" is not in the approved event taxonomy`);
  }

  if (isPrivatePath(window.location.pathname)) {
    if (allowedOnPrivatePath(event)) sendAnalyticsEvent(event, context);
    return;
  }

  const attribution = storedAttribution();
  const payload = {
    // GTM's data model keeps every key it has ever seen: without these resets a "service" from
    // an earlier service_view would be reported on a later whatsapp_click that has no service.
    placement: undefined,
    section: undefined,
    service: undefined,
    branch: undefined,
    item: undefined,
    detail: undefined,
    event,
    page: window.location.pathname,
    source: attribution.source ?? attribution.utm_source,
    medium: attribution.medium ?? attribution.utm_medium,
    campaign: attribution.campaign ?? attribution.utm_campaign,
    content: attribution.content ?? attribution.utm_content,
    ...context,
  };

  window.dataLayer ??= [];
  window.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent("velto:analytics", { detail: payload }));
  sendAnalyticsEvent(event, context);
}

/**
 * WhatsApp taps on public pages carry the visitor's campaign context to /go/whatsapp, which
 * records the tap with a short reference and adds "Ref: W7K2PQ" to the message
 * (lib/whatsapp-ref.ts). Advertising ids only with Marketing consent; the server re-checks the
 * consent cookie. Customer-account pages are left alone. The original href is kept so a second
 * tap starts from it rather than stacking parameters.
 */
/** The service a service page is about ("/services/curtain-cleaning" → "curtain-cleaning"). */
const servicePageSlug = () => window.location.pathname.match(/^(?:\/bn)?\/services\/([a-z-]+)/)?.[1];

function tagWhatsAppHref(el: HTMLAnchorElement) {
  if (isPrivatePath(window.location.pathname)) return;
  try {
    const original = el.dataset.waHref ?? el.getAttribute("href") ?? "/go/whatsapp";
    el.dataset.waHref = original;
    const url = new URL(original, window.location.origin);
    const context = submissionAttribution();
    const landing = storedAttribution().landing_page ?? window.location.pathname;
    for (const [key, value] of Object.entries({ ...context, landing_page: landing })) {
      if (value && key !== "consent" && !url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    const service = el.dataset.service ?? servicePageSlug();
    if (service && !url.searchParams.has("service")) url.searchParams.set("service", service);
    if (/^\/bn(?:\/|$)/.test(window.location.pathname)) url.searchParams.set("lang", "bn");
    url.searchParams.set("wr", "1");
    el.setAttribute("href", `${url.pathname}${url.search}`);
  } catch {
    /* keep the original href */
  }
}

/**
 * Delegated click tracking for elements carrying data-analytics, plus campaign
 * attribution carried onto /book and /quote links (spec §9, §22) via the
 * shared allowlist sanitizer (src/lib/attribution.ts). Existing destination
 * parameters always win.
 */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    track("page_view");
  }, [pathname]);

  useEffect(() => {
    captureAttributionFromUrl();

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "[data-analytics], a[href^='/book'], a[href^='/quote'], a[href^='/go/whatsapp']",
      );
      if (!el) return;

      if (el instanceof HTMLAnchorElement && el.getAttribute("href")?.startsWith("/go/whatsapp")) {
        tagWhatsAppHref(el);
      } else if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href");
        if (href && /^(?:\/bn)?\/(book|quote)(?:\/|\?|#|$)/.test(href)) {
          try {
            el.setAttribute("href", appendAttribution(href, consentedAttribution(storedAttribution())));
          } catch {
            /* keep the original href */
          }
        }
      }

      const event = el.dataset.analytics;
      if (event) {
        track(event, {
          placement: el.dataset.placement,
          section: el.closest("section")?.id || undefined,
          service: el.dataset.service ?? servicePageSlug(),
          branch: el.dataset.branch,
        });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
