/**
 * B999: 3 Regular/Medium blankets for ৳999, the blanket landing page (/blanket-cleaning-uttara).
 * The one place for the campaign's business rules: price maths, the daily cap, the offered pickup
 * days, the service area, turnaround and the heavy add-on. Pure and runtime-neutral, so the page,
 * the booking API, the admin page and the unit tests (tests/command-center/b999.test.cjs) share it.
 * The database enforces the same fixed values (docs/technical/sql/website_b999.sql).
 */

export const B999 = {
  offerCode: "B999-WEB",
  package: "B999",
  service: "Blanket Cleaning",
  itemType: "Regular Blanket",
  quantity: 3,
  packagePrice: 999,
  currency: "BDT",
  acquisitionSource: "WEBSITE",
  campaignFamily: "BLANKET",
  paymentMethod: "Pay at delivery",
  /** List prices (Ops price list, "Blanket (Regular/Medium)" / "Blanket (Large/Heavy)", washed). */
  regularPrice: 400,
  heavyPrice: 450,
  /** Price-list rows the list prices are checked against before the page offers the package. */
  regularItem: "Blanket (Regular/Medium)",
  heavyItem: "Blanket (Large/Heavy)",
  priceListService: "Wash & Iron",
  /** Each package blanket reclassified as heavy at pickup or intake (with the customer's approval). */
  heavyAddOn: 50,
  /** B999 bookings per pickup day. Never raised automatically. */
  dailyCap: 4,
  /** Pickup days offered: from `firstDayOffset` days after today, for `daysAhead` days. */
  firstDayOffset: 1,
  daysAhead: 7,
  /** Weekdays never offered (0 = Sunday … 6 = Saturday). */
  closedWeekdays: [] as number[],
  /** Uttara sectors served. Anything else goes to WhatsApp. */
  sectors: Array.from({ length: 18 }, (_, i) => i + 1),
  turnaroundDays: { min: 3, max: 4 },
} as const;

export type B999Count = {
  /** Blankets in the 3-pack that stay regular/medium. */
  regular: number;
  /** Blankets in the 3-pack reclassified as heavy and accepted by the customer. */
  heavy: number;
  /** Blankets beyond the first 3. */
  extraRegular?: number;
  extraHeavy?: number;
};

/**
 * The total for what the customer accepted. The ৳999 package needs 3 eligible blankets; each
 * heavy one in it adds ৳50. Fewer than 3 eligible: list price each. Extras: list price each, and
 * never a second package.
 */
export function b999Total(c: B999Count): { total: number; packageApplies: boolean } {
  const n = (v: number | undefined) => Math.max(0, Math.floor(Number(v) || 0));
  const regular = n(c.regular);
  const heavy = n(c.heavy);
  const extras = n(c.extraRegular) * B999.regularPrice + n(c.extraHeavy) * B999.heavyPrice;
  if (regular + heavy >= B999.quantity) {
    // The first 3 form the package; any further pack blankets are priced as extras.
    const packHeavy = Math.min(heavy, B999.quantity);
    const packRegular = B999.quantity - packHeavy;
    const overHeavy = heavy - packHeavy;
    const overRegular = regular - packRegular;
    return {
      total: B999.packagePrice + packHeavy * B999.heavyAddOn + overRegular * B999.regularPrice + overHeavy * B999.heavyPrice + extras,
      packageApplies: true,
    };
  }
  return { total: regular * B999.regularPrice + heavy * B999.heavyPrice + extras, packageApplies: false };
}

/**
 * The customer declined the heavy price for some package blankets: those are returned unprocessed
 * and the rest is recalculated (3 eligible stay ৳999, fewer go to list price).
 */
export function b999AfterDecline(c: B999Count, declinedHeavy: number) {
  const d = Math.max(0, Math.min(Math.floor(declinedHeavy) || 0, c.heavy));
  return b999Total({ ...c, heavy: c.heavy - d });
}

/** True when the live price list still says ৳400 / ৳450; otherwise the package is not offered. */
export function listPricesMatch(regularTaka: number | null | undefined, heavyTaka: number | null | undefined) {
  return regularTaka === B999.regularPrice && heavyTaka === B999.heavyPrice;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Today's date in Dhaka (YYYY-MM-DD). */
export function dhakaToday(now = new Date()) {
  return ymd(new Date(now.getTime() + 6 * 3_600_000));
}

/** The pickup days the campaign offers, in order (before the cap). */
export function offeredDays(today: string): string[] {
  const start = new Date(`${today}T00:00:00Z`);
  const days: string[] = [];
  for (let i = B999.firstDayOffset; days.length < B999.daysAhead && i < B999.firstDayOffset + B999.daysAhead + 7; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    if ((B999.closedWeekdays as readonly number[]).includes(d.getUTCDay())) continue;
    days.push(ymd(d));
  }
  return days;
}

/** Offered days that still have space, given bookings per day. */
export function openDays(today: string, booked: Record<string, number>): string[] {
  return offeredDays(today).filter((d) => (booked[d] ?? 0) < B999.dailyCap);
}

export const isSector = (v: unknown) => Number.isInteger(Number(v)) && (B999.sectors as readonly number[]).includes(Number(v));

/** The note Ops staff see on the pickup task is fixed in the database (website_b999_book). */

/** WhatsApp messages (prefilled). */
export const b999WhatsApp = {
  check: "Hi Velto, I want to check whether my blanket qualifies for the ৳999 package. Reference: B999-WEB",
  booked: (ref: string) => `Hi Velto, I booked the 3 Blanket ৳999 package.\nBooking: ${ref}`,
  outside: "Hi Velto, I'm outside Uttara Sectors 1 to 18 and want the 3 Blanket ৳999 package. Can you check my area? Reference: B999-WEB",
};

/** Words the campaign copy must never contain (unit-tested against every page string). */
export const B999_BANNED = [/—/, /wash\s*(\+|&|and)\s*iron/i, /ওয়াশ ও আয়রন/, /\bsave\b/i, /%/, /discount/i, /sale\b/i, /#1/, /most trusted/i, /best laundry/i, /perfect clean/i, /ছাড়(?!া)/, /ডিসকাউন্ট/];
