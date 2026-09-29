"use client";

import { useSyncExternalStore } from "react";
import { isNightDhaka } from "@/lib/call-hours";

// Re-checked each minute, so a page left open past 9 PM (or 9 AM) changes its wording.
const subscribe = (change: () => void) => {
  const id = window.setInterval(change, 60_000);
  return () => window.clearInterval(id);
};
const nightNow = () => isNightDhaka();

/**
 * Night in Dhaka (9 PM to 9 AM), when Velto calls back in the morning. False on the server and
 * on the first render, so the page hydrates with the daytime wording and then switches.
 */
export const useNightDhaka = () => useSyncExternalStore(subscribe, nightNow, () => false);
