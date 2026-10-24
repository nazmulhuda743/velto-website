/**
 * The Book Pickup form's state and the pure functions around it: validation, the English Ops
 * payload (toBookingData), the WhatsApp fallback text, date and area labels, and the estimate.
 * Moved verbatim from BookingForm.tsx; no components or hooks here.
 */
import { WHATSAPP_URL } from "@/content/site";
import {
  estimateBooking,
  isGarmentService,
  MIXED_ITEM,
  sharedItemService,
  type BookingEstimate,
  type BookingItem,
  type GarmentService,
} from "@/lib/booking-items";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import type { UpsellHints } from "@/lib/booking-upsell";
import { lineUnit, money, type ItemLine } from "./BookingItems";
import { normalisePhone, phoneOk } from "./fields";
import { hoursText, type PickedWindow } from "./PickupWindows";
import type { BookingFormData } from "./submit";

export type Text = FormText["booking"];
export type Common = FormText["common"];

export const OUTSIDE = "outside";
export const NO_HINTS: UpsellHints = { usual: [], pairs: [] };

/** Today in Dhaka (YYYY-MM-DD): pickup days are Dhaka days. */
const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);

export type Photo = { key: string; preview: string; status: "uploading" | "done" | "failed"; id?: string };

/** Orders are usually ready in about 3 days (spec §4: ~72 hours), so "back by" starts 3 days after pickup. */
const BACK_BY_DAYS = 3;

export type FormState = {
  /** From a service page (?service=). A household service (curtains, carpets, blankets) stays as the booking's service. */
  service: string | null;
  /** Dry Cleaning, Wash & Iron and/or Ironing (chips, optional in the quick form). */
  services: GarmentService[];
  /** "4 curtains, some shirts": what to pick up, in the customer's words. */
  what: string;
  items: ItemLine[];
  sector: string;
  address: string;
  /** The pickup day and window (booked: from live capacity, reserved on Confirm). */
  pickup: PickedWindow | null;
  backBy: string;
  name: string;
  phone: string;
  notes: string;
  photos: Photo[];
};

type ErrorKey = "what" | "name" | "phone" | "sector" | "address" | "date" | "slot" | "backBy" | "photos";
export type Errors = Partial<Record<ErrorKey, string>>;

export const displayPhone = (v: string) => {
  const n = normalisePhone(v);
  return /^01\d{9}$/.test(n) ? `${n.slice(0, 5)} ${n.slice(5)}` : n;
};

const isoDate = (offsetDays = 0, from?: string) => {
  const d = from ? new Date(`${from}T00:00:00`) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The pickup date the customer asked for, if any (ISO). */
const pickupIso = (s: FormState) => s.pickup?.date ?? "";

/** Earliest "back by" date: about 3 days after the preferred pickup (or today). */
export const earliestBackBy = (s: FormState) => isoDate(BACK_BY_DAYS, pickupIso(s) || undefined);

/** Words for dates: English for Ops, or the page language for the customer. */
type DateWords = {
  today: string;
  tomorrow: string;
  weekdays: readonly string[];
  months: readonly string[];
  dayMonth: string;
  locale: Locale;
};

/** What Velto Ops receives, whatever the page language. */
const OPS_WORDS: DateWords = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  dayMonth: "{weekday} {day} {month}",
  locale: "en",
};

export const niceDate = (iso: string, w: DateWords) => {
  const d = new Date(`${iso}T00:00:00`);
  return fill(w.dayMonth, { weekday: w.weekdays[d.getDay()], day: d.getDate(), month: w.months[d.getMonth()] }, w.locale);
};

/** Ops area label ("Uttara Sector 7"): the value Velto Ops matches on. Never localized. */
export const areaLabel = (sector: string) => (sector === OUTSIDE ? "Outside Uttara Sectors 1–18" : `Uttara Sector ${sector}`);

/** The same area as the customer reads it. */
export const areaText = (sector: string, t: Text, locale: Locale) =>
  sector === OUTSIDE ? t.areaOutside : fill(t.areaSector, { n: sector }, locale);

export const isHousehold = (s: FormState) => Boolean(s.service && !isGarmentService(s.service));

export const itemsOf = (s: FormState): BookingItem[] =>
  s.items.map((l) => ({ item: l.item, quantity: l.quantity, ...(l.service ? { service: l.service } : {}) }));

/** Ops "Service": the one all item lines share, else a household service from the page, else the one chosen service. */
export const bookingService = (s: FormState) =>
  (s.items.length ? sharedItemService(itemsOf(s)) : undefined) ??
  (isHousehold(s) ? (s.service ?? undefined) : s.services.length === 1 ? s.services[0] : undefined);

export const estimateOf = (s: FormState, chargeMinor: number | null) =>
  estimateBooking(
    s.items.map((l) => ({ quantity: l.quantity, unitMinor: lineUnit(l) })),
    chargeMinor,
  );

/** Item lines as the customer reads them; in English exactly bookingItemsText (what Ops gets in the notes). */
const itemsText = (items: BookingItem[], t: Text, locale: Locale) =>
  items
    .map(
      (i) =>
        `${localDigits(i.quantity, locale)} × ${i.item === MIXED_ITEM ? t.mixedItem : i.item} – ${i.service ? t.services[i.service] : t.itemNotSure}`,
    )
    .join("; ");

/** The chosen services (or the page's household service) as the customer reads them. */
const servicesText = (s: FormState, t: Text) =>
  isHousehold(s) ? (t.services[s.service ?? ""] ?? "") : s.services.map((x) => t.services[x]).join(", ");

/** One line for summaries: what the customer wrote, then the items or the chosen services. */
export const whatLabel = (s: FormState, t: Text, locale: Locale) =>
  [s.what.trim(), s.items.length ? itemsText(itemsOf(s), t, locale) : servicesText(s, t)].filter(Boolean).join(" · ");

/** The customer's own words lead the Ops notes, so staff read them first. */
const opsNotes = (s: FormState) => [s.what.trim() ? `Picking up: ${s.what.trim()}` : "", s.notes.trim()].filter(Boolean).join(" · ") || undefined;

const OPS_WINDOWS: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };

/**
 * Pickup day and window, e.g. "Tomorrow Tue 29 Sep, Evening 4–8 PM (window booked)". With
 * OPS_WORDS (and no `slots`) this is the contract's preferredPickup string, in English; the
 * customer's version uses t.slots and the page language.
 */
export function pickupLabel(s: FormState, w: DateWords = OPS_WORDS, slots?: Record<string, string>) {
  const p = s.pickup;
  if (!p) return "";
  const today = dhakaToday();
  const prefix = p.date === today ? w.today : p.date === isoDate(1, today) ? w.tomorrow : "";
  const day = `${prefix} ${niceDate(p.date, w)}`.trim();
  const window = slots
    ? `${slots[p.window]} ${hoursText(p.starts, p.ends, w.locale)}`
    : `${OPS_WINDOWS[p.window]} ${hoursText(p.starts, p.ends, "en")}${p.booked ? " (window booked)" : ""}`;
  return `${day}, ${window}`;
}

/** "earlier today" / "yesterday" / "3 days ago" for the continue banner. */
export function draftWhen(savedAt: number, t: Text, locale: Locale) {
  const days = Math.floor((Date.now() - savedAt) / 86_400_000);
  return days <= 0 ? t.draftToday : days === 1 ? t.draftDay : fill(t.draftDays, { n: days }, locale);
}

export const pageWords = (t: Text, c: Common, locale: Locale): DateWords => ({
  today: t.today,
  tomorrow: t.tomorrow,
  weekdays: c.weekdays,
  months: c.months,
  dayMonth: c.dayMonth,
  locale,
});

/** The Ops payload: English values only, identical whatever the page language. */
export function toBookingData(s: FormState): BookingFormData {
  return {
    name: s.name.trim(),
    phone: normalisePhone(s.phone),
    area: areaLabel(s.sector),
    address: s.address.trim(),
    preferredPickup: pickupLabel(s),
    service: bookingService(s),
    ...(s.services.length ? { services: s.services } : {}),
    ...(s.items.length ? { items: itemsOf(s) } : {}),
    ...(s.backBy ? { deliveryBy: s.backBy } : {}),
    ...(uploadedPhotos(s).length ? { photos: uploadedPhotos(s) } : {}),
    notes: opsNotes(s),
    ...(s.pickup?.booked ? { slot: { date: s.pickup.date, window: s.pickup.window } } : {}),
  };
}

/** Ids of the photos that finished uploading (a failed one is simply left out). */
export const uploadedPhotos = (s: FormState) => s.photos.flatMap((p) => (p.status === "done" && p.id ? [p.id] : []));

/** The estimate as one phrase for WhatsApp ("৳610"), when anything could be priced. */
export const estimateLabel = (e: BookingEstimate, locale: Locale) => (e.subtotalMinor > 0 ? money(e.totalMinor, locale) : "");

/** WhatsApp fallback carries what the customer already typed (in their language), so nothing is lost. */
export function whatsappHref(s: FormState, t: Text, c: Common, locale: Locale, chargeMinor: number | null) {
  const w = t.whatsapp;
  const words = pageWords(t, c, locale);
  const when = pickupLabel(s, words, t.slots);
  const estimate = estimateLabel(estimateOf(s, chargeMinor), locale);
  const lines = [
    w.greeting,
    s.what.trim() ? format(w.what, { v: s.what.trim() }) : "",
    s.items.length ? format(w.items, { v: itemsText(itemsOf(s), t, locale) }) : servicesText(s, t) ? format(w.service, { v: servicesText(s, t) }) : "",
    estimate ? format(w.estimate, { v: estimate }) : "",
    s.sector ? format(w.area, { v: areaText(s.sector, t, locale) }) : "",
    s.address.trim() ? format(w.address, { v: s.address.trim() }) : "",
    when ? format(w.pickup, { v: when }) : "",
    s.backBy ? format(w.backBy, { v: niceDate(s.backBy, words) }) : "",
    s.name.trim() ? format(w.name, { v: s.name.trim() }) : "",
    s.notes.trim() ? format(w.note, { v: s.notes.trim() }) : "",
  ].filter(Boolean);
  return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function validate(s: FormState, t: Text, c: Common, locale: Locale): Errors {
  const e: Errors = {};
  // Anything that says what to collect: words, a service chip, or items.
  if (!s.what.trim() && !s.services.length && !isHousehold(s) && !s.items.length) e.what = t.errors.what;
  if (!s.name.trim()) e.name = t.errors.name;
  if (!s.phone.trim()) e.phone = c.phoneMissing;
  else if (!phoneOk(s.phone)) e.phone = c.phoneInvalid;
  if (!s.sector) e.sector = t.errors.sector;
  if (!s.address.trim()) e.address = t.errors.address;
  if (!s.pickup && s.sector) e.slot = t.errors.slot;
  if (s.photos.some((p) => p.status === "uploading")) e.photos = t.photosWait;
  const earliest = earliestBackBy(s);
  if (s.backBy && s.backBy < earliest) e.backBy = fill(t.errors.backBy, { date: niceDate(earliest, pageWords(t, c, locale)) }, locale);
  return e;
}

export const FIELD_ORDER: ErrorKey[] = ["what", "name", "phone", "sector", "address", "date", "slot", "backBy", "photos"];

/** Where each error-summary link goes: the field itself (for "what", the first service chip). */
export const ERROR_TARGET: Record<ErrorKey, string> = {
  what: "booking-service-dry-cleaning",
  name: "booking-name",
  phone: "booking-phone",
  sector: "booking-sector",
  address: "booking-address",
  date: "booking-date",
  slot: "booking-slot",
  backBy: "booking-backBy",
  photos: "booking-photos",
};

export type Coupon = { code: string; kind: "delivery" | "taka"; amount: number };
/** The 10% account offer line: "yours" (signed in) or "guest" (asked to sign in first). */
/** The first-order 10% line: "yours" for a signed-in customer's first website order, "guest" asks to sign in first. */
export type FirstOrderLine = "guest" | "yours";

/** A free-delivery reward makes the pickup & delivery line free whatever the subtotal; an amount off is applied by Velto at confirmation. */
export const withCoupon = (e: BookingEstimate, coupon?: Coupon): BookingEstimate =>
  coupon?.kind === "delivery" && !e.free ? { ...e, free: true, chargeMinor: 0, totalMinor: e.subtotalMinor } : e;
