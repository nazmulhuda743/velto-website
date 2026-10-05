"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { analyticsSessionId, currentDevice, sendAnalyticsEvent } from "@/lib/analytics/client";
import { destinationEntry, eventIds, serviceFromPath } from "@/lib/analytics/destinations";
import { allowedOnPrivatePath, isAnalyticsEvent } from "@/lib/analytics/events";
import { blocksThirdPartyTags, isPrivatePath } from "@/lib/analytics/private-paths";
import { appendAttribution } from "@/lib/attribution";
import { captureAttributionFromUrl, consentedAttribution, storedAttribution } from "@/lib/attribution-client";
import { whatsappRefHref } from "@/lib/whatsapp-ref";

type Payload = Record<string, string | undefined>;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

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
  // The GA4 / Meta translation (src/lib/analytics/destinations.ts), read by the generic GTM tags.
  const entry = blocksThirdPartyTags(window.location.pathname) ? null : destinationEntry(event, payload, newId);
  if (entry) window.dataLayer.push(entry);
  window.dispatchEvent(new CustomEvent("velto:analytics", { detail: payload }));
  sendAnalyticsEvent(event, context);
}

/**
 * A WhatsApp link on a public page: ask /go/whatsapp for a reference (src/lib/whatsapp-ref.ts),
 * sending this click's id plus the consented campaign context. Returns the Meta event id that
 * the stored reference will share.
 */
function prepareWhatsAppLink(el: HTMLAnchorElement, placement: string | undefined, service: string | undefined) {
  const href = el.getAttribute("href");
  if (!href || !/^\/go\/whatsapp(?:\?|$)/.test(href)) return undefined;
  const clickId = newId();
  try {
    el.setAttribute(
      "href",
      whatsappRefHref(href, {
        clickId,
        page: window.location.pathname,
        placement,
        service,
        device: currentDevice(),
        analyticsSession: analyticsSessionId(),
        attribution: consentedAttribution(storedAttribution()),
      }),
    );
  } catch {
    return undefined;
  }
  return eventIds.contact(clickId);
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
        "[data-analytics], a[href^='/book'], a[href^='/quote']",
      );
      if (!el) return;

      if (el instanceof HTMLAnchorElement) {
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
        const placement = el.dataset.placement;
        const service = el.dataset.service ?? serviceFromPath(window.location.pathname);
        const eventId =
          event === "whatsapp_click" && el instanceof HTMLAnchorElement && !blocksThirdPartyTags(window.location.pathname)
            ? prepareWhatsAppLink(el, placement, service)
            : undefined;
        track(event, {
          placement,
          section: el.closest("section")?.id || undefined,
          service,
          branch: el.dataset.branch,
          event_id: eventId,
        });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
