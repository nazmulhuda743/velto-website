"use client";

import { useEffect } from "react";
import { reportNotFound } from "@/lib/analytics/client";

/**
 * Tells the Health Center a page was not found. Anonymous and essential:
 * only the requested pathname (no query string) is sent, with no visitor or
 * session identifier, so it does not depend on analytics consent.
 */
export function NotFoundBeacon() {
  useEffect(() => {
    reportNotFound(window.location.pathname);
  }, []);
  return null;
}
