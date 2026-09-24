"use client";

import { useEffect } from "react";

const ATTRIBUTION_KEY = "velto_attribution";
const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
];

type Payload = Record<string, string | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Emits UI events (spec §23). No production analytics IDs are configured here. */
export function track(event: string, context: Payload = {}) {
  const payload = { event, page: window.location.pathname, ...context };
  window.dataLayer?.push(payload);
  window.dispatchEvent(new CustomEvent("velto:analytics", { detail: payload }));
}

/**
 * Delegated click tracking for elements carrying data-analytics, plus
 * campaign attribution carried onto /book and /quote links (spec §9, §22).
 */
export function Analytics() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const found = ATTRIBUTION_PARAMS.filter((k) => params.get(k));
      if (found.length && !sessionStorage.getItem(ATTRIBUTION_KEY)) {
        const data: Payload = { landing_page: window.location.pathname };
        found.forEach((k) => (data[k] = params.get(k) ?? undefined));
        sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(data));
      }
    } catch {
      /* storage unavailable — attribution is best-effort */
    }

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-analytics], a[href^='/book'], a[href^='/quote']");
      if (!el) return;

      if (el instanceof HTMLAnchorElement && /^\/(book|quote)/.test(el.getAttribute("href") ?? "")) {
        try {
          const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
          if (stored) {
            const url = new URL(el.href);
            Object.entries(JSON.parse(stored) as Payload).forEach(([k, v]) => {
              if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
            });
            el.href = url.toString();
          }
        } catch {
          /* ignore */
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
