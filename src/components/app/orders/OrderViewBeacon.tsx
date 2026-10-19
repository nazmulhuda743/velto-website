"use client";

import { useEffect } from "react";
import { track } from "@/components/layout/Analytics";

/** One view per screen, even when the effect runs twice (React dev mode, a remount). */
let last = { step: "", at: 0 };

/** order_view for the app report: an order was opened, with its tracker step only (never the order number). */
export function OrderViewBeacon({ step }: { step: string }) {
  useEffect(() => {
    if (last.step === step && Date.now() - last.at < 2_000) return;
    last = { step, at: Date.now() };
    track("order_view", { placement: "app_order", detail: step });
  }, [step]);
  return null;
}
