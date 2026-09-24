import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { SEO_ROUTES } from "@/content/seo-routes";
import { isAnalyticsWritesEnabled } from "../analytics/store";
import { configuredGtmId } from "../gtm";
import { isPricingConfigured } from "../integrations/pricing/server";
import { getSiteContent } from "../site-content";
import { getAnalyticsHealth, getRequests, getServerEvents } from "./analytics-data";
import { isAdminPreview } from "./preview";
import { requestDetails } from "./request-details";

/**
 * Dashboard notifications, derived on each server render from data the
 * dashboard already reads (Ops requests, server events, analytics health,
 * content). No realtime infrastructure: the panel layout refreshes itself
 * every two minutes while visible (NotificationRefresher).
 */

export const SEEN_COOKIE = "velto_admin_seen";

export type Notification = {
  id: string;
  tone: "action" | "error" | "warning" | "info";
  title: string;
  body: string;
  href: string;
  action: string;
  at: string | null;
};

const HOUR = 3_600_000;

export const getNotifications = cache(async (): Promise<{ items: Notification[]; unread: number }> => {
  const [requests, events, analytics, content] = await Promise.all([
    getRequests(200),
    getServerEvents(2),
    getAnalyticsHealth(),
    getSiteContent(),
  ]);
  const now = Date.now();
  const items: Notification[] = [];

  if (requests.state === "ok") {
    const fresh = requests.data.filter((r) => r.status !== "done" && now - Date.parse(r.created_at) < 24 * HOUR);
    for (const r of fresh.slice(0, 6)) {
      const d = requestDetails(r.description);
      const booking = r.source === "website_booking";
      items.push({
        id: `request-${r.id}`,
        tone: "action",
        title: booking ? "New website booking" : "New quote request",
        body: [d.Name, d.Service, d.Area].filter(Boolean).join(" · ") || r.title,
        href: `/admin/requests?filter=new`,
        action: "Open in requests",
        at: r.created_at,
      });
    }
    const stale = requests.data.filter((r) => r.status !== "done" && now - Date.parse(r.created_at) >= 24 * HOUR);
    if (stale.length) {
      items.push({
        id: `stale-${stale.length}`,
        tone: "warning",
        title: `${stale.length} request${stale.length === 1 ? "" : "s"} open for more than 24 hours`,
        body: "Still open in the Velto Ops task list.",
        href: "/admin/requests?filter=open",
        action: "Review open requests",
        at: stale[0].created_at,
      });
    }
  } else if (requests.state === "error") {
    items.push({ id: "requests-down", tone: "error", title: "Requests unavailable", body: requests.message, href: "/admin/health", action: "Check health", at: null });
  }

  if (events.state === "ok") {
    const since = (kind: string) => events.data.filter((e) => e.kind === kind && now - Date.parse(e.occurred_at) < 24 * HOUR);
    const groups: [string, string, string][] = [
      ["booking_error", "Booking requests are failing", "Customers saw an error while booking."],
      ["quote_error", "Quote requests are failing", "Customers saw an error while requesting a quote."],
      ["pricing_error", "Pricing API unavailable", "Price search returned an error to visitors."],
      ["tracking_error", "Order tracking unavailable", "Order tracking returned an error."],
      ["media_upload_error", "Media upload failed", "An image upload in the dashboard did not complete."],
      ["content_save_error", "Content save failed", "A dashboard change was not saved."],
    ];
    for (const [kind, title, body] of groups) {
      const hits = since(kind);
      if (hits.length) {
        items.push({ id: `${kind}-${hits[0].id}`, tone: "error", title, body: `${body} ${hits.length}× in 24 h.`, href: "/admin/health", action: "Open health center", at: hits[0].occurred_at });
      }
    }
  }

  if (isAnalyticsWritesEnabled() || isAdminPreview()) {
    if (analytics.state === "ok") {
      const last = analytics.data.last_event_at ? Date.parse(analytics.data.last_event_at) : null;
      if (!last || now - last > 6 * HOUR) {
        items.push({
          id: `ingestion-${last ?? 0}`,
          tone: "warning",
          title: "Consent-based tracking stopped",
          body: last ? `No analytics event received in ${Math.round((now - last) / HOUR)} hours.` : "No analytics event has been received yet.",
          href: "/admin/consent",
          action: "Check tracking",
          at: analytics.data.last_event_at,
        });
      }
    } else if (analytics.state === "error") {
      items.push({ id: "analytics-down", tone: "error", title: "Analytics database unavailable", body: analytics.message, href: "/admin/health", action: "Check health", at: null });
    }
  }

  if (!configuredGtmId()) {
    items.push({ id: "gtm-missing", tone: "info", title: "GTM container ID is missing", body: "GA4 and Meta Pixel cannot run until NEXT_PUBLIC_GTM_ID is set.", href: "/admin/consent", action: "See tracking status", at: null });
  }
  if (!isPricingConfigured()) {
    items.push({ id: "pricing-mock", tone: "info", title: "Live prices are not connected", body: "The website is showing its marked sample prices.", href: "/admin/health", action: "See health", at: null });
  }

  const noindexed = SEO_ROUTES.filter((r) => content.seo[r.path]?.noindex);
  if (noindexed.length) {
    items.push({
      id: `noindex-${noindexed.map((r) => r.path).join(",")}`,
      tone: "warning",
      title: `${noindexed.length} page${noindexed.length === 1 ? " is" : "s are"} hidden from Google`,
      body: noindexed.map((r) => r.label).slice(0, 4).join(", "),
      href: "/admin/seo?view=noindex",
      action: "Review SEO",
      at: null,
    });
  }

  const seenRaw = (await cookies()).get(SEEN_COOKIE)?.value;
  const seen = seenRaw ? Number(seenRaw) : 0;
  const order = { error: 0, action: 1, warning: 2, info: 3 };
  items.sort((a, b) => order[a.tone] - order[b.tone] || (b.at ?? "").localeCompare(a.at ?? ""));
  // Timed items are unread until marked read; standing conditions resurface a day after being marked read.
  const unread = items.filter((n) => n.tone !== "info" && (n.at ? Date.parse(n.at) > seen : now - seen > 24 * HOUR)).length;
  return { items, unread };
});
