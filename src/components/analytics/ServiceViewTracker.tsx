"use client";

import { useEffect } from "react";
import { track } from "@/components/layout/Analytics";

export function ServiceViewTracker({ service }: { service: string }) {
  useEffect(() => {
    // React runs this (child) effect before the layout's page_view effect; deferring one tick
    // keeps the order page_view → service_view, which GA4 funnels and Meta's PageView → ViewContent expect.
    const id = window.setTimeout(() => track("service_view", { service }), 0);
    return () => window.clearTimeout(id);
  }, [service]);

  return null;
}
