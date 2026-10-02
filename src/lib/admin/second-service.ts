import "server-only";

import { isAdminPreview } from "./preview";
import { normaliseBdPhone } from "../customer/validation";
import { invoicesReady, secondServiceStats, serviceMix, type SecondServiceStats } from "../invoice-server";
import { staffAsk, type NextService } from "../second-service";

/**
 * Admin side of the Second Service ladder (docs/technical/SECOND-SERVICE.md): the service to ask
 * each customer on Today about, and the Reminders page's conversion numbers. Never throws: a
 * missing hint or tile must not break Today.
 */
export async function serviceAsks(phones: (string | null | undefined)[]): Promise<Map<string, NextService>> {
  const keys = [...new Set(phones.map((p) => (p ? normaliseBdPhone(p) : null)).filter((p): p is string => Boolean(p)))];
  const asks = new Map<string, NextService>();
  if (!keys.length) return asks;
  if (isAdminPreview()) {
    // Synthetic hint on the first caller so the design can be checked locally.
    asks.set(keys[0], "dry-cleaning");
    return asks;
  }
  if (!invoicesReady()) return asks;
  try {
    for (const row of (await serviceMix(keys)) ?? []) {
      const ask = staffAsk(row);
      if (ask) asks.set(row.phone, ask);
    }
  } catch (error) {
    // website_second_service.sql not applied yet, or Ops unreachable: no hints.
    console.error("service_mix_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
  }
  return asks;
}

export async function getSecondServiceStats(days: number): Promise<SecondServiceStats | null> {
  if (isAdminPreview()) return { days, dcOnly: 291, dcOnlyAdded: 44, everydayOnly: 236, everydayOnlyAdded: 19, linkRatings: 12, routineAsks: 5, addonAsks: 7 };
  if (!invoicesReady()) return null;
  try {
    return await secondServiceStats(days);
  } catch {
    return null;
  }
}
