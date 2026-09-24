"use client";

import { useEffect } from "react";
import { track } from "@/components/layout/Analytics";

export function ServiceViewTracker({ service }: { service: string }) {
  useEffect(() => {
    track("service_view", { service });
  }, [service]);

  return null;
}
