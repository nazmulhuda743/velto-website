"use client";

import { useEffect, useState } from "react";
import { fallbackDays } from "@/components/forms/PickupWindows";
import type { AvailabilityDay } from "@/lib/capacity-logic";
import type { SlotDay } from "@/lib/customer/app-logic";

export type PickupLoad = { state: "loading" } | { state: "ready"; days: SlotDay[]; today: string; live: boolean } | { state: "unavailable" };

const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);

/**
 * Pickup days for an Uttara sector, as every app screen reads them (Home rebook, the weekly offer,
 * Book): live capacity when it is on; otherwise the usual preference windows Velto confirms by call.
 * One source, so the same address always gets the same default slot everywhere.
 */
export function usePickupDays(sector: number | null, reload = 0): PickupLoad {
  const [load, setLoad] = useState<PickupLoad>({ state: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    const preference = () =>
      setLoad({
        state: "ready",
        today: dhakaToday(),
        live: false,
        days: fallbackDays().map((d) => ({ date: d.date, windows: d.windows.map((w) => ({ ...w, left: w.status === "open" ? 1 : 0 })) })),
      });
    if (!sector) {
      preference();
      return () => controller.abort();
    }
    fetch(`/api/capacity?sector=${sector}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { enabled?: boolean; zone?: string | null; today?: string; days?: AvailabilityDay[] } | null;
        if (!body || body.enabled !== true || (res.ok && !body.zone)) return preference();
        if (!res.ok || !Array.isArray(body.days)) return setLoad({ state: "unavailable" });
        setLoad({ state: "ready", days: body.days, today: body.today ?? dhakaToday(), live: true });
      })
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) preference();
      });
    return () => controller.abort();
  }, [sector, reload]);
  return load;
}
