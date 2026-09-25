"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the dashboard every two minutes while the tab is visible (V1 notifications: polling, no realtime). */
export function NotificationRefresher({ intervalMs = 120_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
