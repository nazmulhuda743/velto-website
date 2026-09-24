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

/** Emits UI events (spec §23). No production analytics IDs are configured here. */
export function track(event: string, context: Payload = {}) {
  if (process.env.NODE_ENV !== "production" && !isAnalyticsEvent(event)) {
    console.warn(`[analytics] "${event}" is not in the approved event taxonomy`);
  }
  const payload = { event, page: window.location.pathname, ...context };
  window.dataLayer?.push(payload);
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
