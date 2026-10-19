"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CONSENT_CHANGE_EVENT, sendAnalyticsEvent } from "@/lib/analytics/client";
import { allowedOnPrivatePath, isAnalyticsEvent } from "@/lib/analytics/events";
import { isPrivatePath } from "@/lib/analytics/private-paths";
import { appendAttribution } from "@/lib/attribution";
import { captureAttributionFromUrl, consentedAttribution, storedAttribution } from "@/lib/attribution-client";
import { sendMetaEvent } from "@/lib/meta-pixel/client";

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
  // Meta Pixel: a no-op unless Marketing consent started it; maps this event (or not) in
  // src/lib/meta-pixel/events.ts. This is the Pixel's only event source, so nothing double-fires.
  sendMetaEvent(event, context);
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

  // The page view for the page the visitor is on fired before they allowed Analytics, so it was
  // dropped: record it once Analytics is newly allowed (first-party only; Meta sends its own).
  useEffect(() => {
    const onConsent = (e: Event) => {
      const { choice, previous } = (e as CustomEvent<{ choice: { analytics: boolean }; previous: { analytics: boolean } | null }>).detail ?? {};
      if (choice?.analytics && !previous?.analytics && !isPrivatePath(window.location.pathname)) sendAnalyticsEvent("page_view");
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onConsent);
  }, []);

  useEffect(() => {
    captureAttributionFromUrl();

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "[data-analytics], a[href^='/book'], a[href^='/quote']",
      );
      if (!el) return;

      // The service a /book or /quote link preselects (?service=…), when the button names none.
      let linkService: string | undefined;
      if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href");
        if (href && /^(?:\/bn)?\/(book|quote)(?:\/|\?|#|$)/.test(href)) {
          try {
            linkService = new URL(href, window.location.origin).searchParams.get("service") || undefined;
          } catch {
            /* no service */
          }
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
          service: el.dataset.service ?? linkService,
          branch: el.dataset.branch,
        });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
