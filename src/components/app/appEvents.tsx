"use client";

import { useEffect } from "react";
import { track } from "@/components/layout/Analytics";

/*
 * The installed app's measurement (VELTO-APP-BUILD-HANDOFF §7). Events go through the usual
 * consent-gated track(); on /app/* only the app's own events are kept (PRIVATE_PATH_EVENTS) and only
 * as short slugs in placement/detail: never an order number, name or address.
 */

const OPENED_KEY = "velto.app.opened";

/** Marks when the app was opened in this session (the first app screen), for "open to booked". */
export function AppOpenClock() {
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(OPENED_KEY)) sessionStorage.setItem(OPENED_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: no timing */
    }
  }, []);
  return null;
}

/** Whole seconds since the app was opened in this session (capped at a day), or undefined. */
export function secondsSinceOpen(): string | undefined {
  try {
    const opened = Number(sessionStorage.getItem(OPENED_KEY));
    if (!opened) return undefined;
    return String(Math.min(86_400, Math.max(0, Math.round((Date.now() - opened) / 1000))));
  } catch {
    return undefined;
  }
}

/** A booking made in the app: the website's booking_success stays the website's conversion. */
export function trackAppBooking(placement: string, service?: string) {
  track("app_booking_success", { placement, service, detail: secondsSinceOpen() });
}

/** Where a booking tap came from: the Home card, "Book this again" on an order, or the Book tab. */
export function rebookPlacement(source: string | null | undefined): "home_card" | "book_again" | "book_tab" {
  if (source?.startsWith("app_home")) return "home_card";
  if (source === "app_order") return "book_again";
  return "book_tab";
}

/** One event when a server-rendered screen shows (Home's state, an order's step, the prices page). */
export function AppEvent({ event, placement, detail }: { event: string; placement?: string; detail?: string }) {
  useEffect(() => {
    track(event, { placement, detail });
  }, [event, placement, detail]);
  return null;
}
