"use client";

import { useEffect } from "react";
import { isAnalyticsEvent } from "@/lib/analytics/events";
import { appendAttribution } from "@/lib/attribution";
import { captureAttributionFromUrl, storedAttribution } from "@/lib/attribution-client";

type Payload = Record<string, string | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Emits approved UI events into one browser-side data layer. GTM can consume
 * these events when configured, while the custom event remains available to
 * local QA without requiring a production analytics ID.
 */
export function track(event: string, context: Payload = {}) {
  if (process.env.NODE_ENV !== "production" && !isAnalyticsEvent(event)) {
    console.warn(`[analytics] "${event}" is not in the approved event taxonomy`);
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
}

/**
 * Delegated click tracking for elements carrying data-analytics, plus campaign
 * attribution carried onto /book and /quote links (spec §9, §22) via the
 * shared allowlist sanitizer (src/lib/attribution.ts). Existing destination
 * parameters always win.
 */
export function Analytics() {
  useEffect(() => {
    captureAttributionFromUrl();

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "[data-analytics], a[href^='/book'], a[href^='/quote']",
      );
      if (!el) return;

      if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href");
        if (href && /^\/(book|quote)(?:\/|\?|#|$)/.test(href)) {
          try {
            el.setAttribute("href", appendAttribution(href, storedAttribution()));
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
          service: el.dataset.service,
          branch: el.dataset.branch,
        });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
