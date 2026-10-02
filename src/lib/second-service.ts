/**
 * The Second Service ladder (docs/technical/SECOND-SERVICE.md): which service to invite a customer to
 * next. A customer on one service is worth ৳366–996; on two, ৳2,400–2,700 (prod, 2026-10-02).
 * Pure, so the invoice page, Admin → Today and the unit tests share it
 * (tests/command-center/second-service.test.cjs).
 */

export type ServiceMix = { orders: number; ironing: boolean; wash: boolean; dryCleaning: boolean };

/** The service the invite is for, as the booking form and the database name it. */
export type NextService = "ironing" | "dry-cleaning" | "wash-and-iron";

/**
 * The next service for a customer, or null when they already use all three (or we know nothing).
 *   Dry Cleaning only → Ironing: the habit (weekly, cheap, 72% come back).
 *   Ironing, never Dry Cleaning → Dry Cleaning: the bigger ticket, on the pickup they already have.
 *   Ironing and Dry Cleaning, never Wash → Wash + Iron.
 */
export function nextService(mix: ServiceMix | null | undefined): NextService | null {
  if (!mix || mix.orders < 1) return null;
  const everyday = mix.ironing || mix.wash;
  if (!everyday) return mix.dryCleaning ? "ironing" : null;
  if (!mix.dryCleaning) return "dry-cleaning";
  if (!mix.wash) return "wash-and-iron";
  return null;
}

/** The invite on the delivered page: a weekly day for the habit, else "add it to the next pickup". */
export const inviteKind = (service: NextService): "routine" | "addon" => (service === "ironing" ? "routine" : "addon");

/**
 * The staff hint on Admin → Today: shown for customers we know (2+ orders for "add a service", any
 * order for dry-cleaning-only customers, whose habit is the bigger prize).
 */
export function staffAsk(mix: ServiceMix | null | undefined): NextService | null {
  const next = nextService(mix);
  if (!next || !mix) return null;
  if (next === "ironing") return next;
  return mix.orders >= 2 ? next : null;
}

/** Items shown with their live price for each invite (names exactly as the Ops price list has them). */
export const INVITE_ITEMS: Record<NextService, { names: string[]; priceService: string }> = {
  ironing: { names: ["Shirt", "Pant", "Panjabi", "Kamiz"], priceService: "Ironing" },
  "dry-cleaning": { names: ["Blazer", "Suit (2pc)", "Sari (Silk)", "Panjabi"], priceService: "Dry Cleaning" },
  "wash-and-iron": { names: ["Shirt", "T-Shirt", "Bed Sheet (Medium)", "Jeans"], priceService: "Wash & Iron" },
};

/** Saturday evening first: the busiest booking time (orders peak 7–10 pm, Saturday is busiest). */
export const DEFAULT_ROUTINE = { weekday: 6, window: "evening" as const };
export const WINDOWS = ["morning", "afternoon", "evening"] as const;
export type RoutineWindow = (typeof WINDOWS)[number];

export function validRoutine(weekday: unknown, window: unknown): { weekday: number; window: RoutineWindow } | null {
  const d = Number(weekday);
  return Number.isInteger(d) && d >= 0 && d <= 6 && WINDOWS.includes(window as RoutineWindow) ? { weekday: d, window: window as RoutineWindow } : null;
}
