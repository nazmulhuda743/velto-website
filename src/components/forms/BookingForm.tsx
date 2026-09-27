"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { track } from "@/components/layout/Analytics";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL } from "@/content/site";
import {
  composeBookingNotes,
  estimateBooking,
  FREE_DELIVERY_MIN_MINOR,
  GARMENT_SERVICES,
  isGarmentService,
  MAX_BOOKING_NOTES,
  MIXED_ITEM,
  NOTE_EXTRAS_RESERVE,
  NOTE_PHOTO_RESERVE,
  sharedItemService,
  type BookingEstimate,
  type BookingItem,
  type GarmentService,
  type ItemService,
} from "@/lib/booking-items";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { BookingItems, lineUnit, money, repeatLine, type ItemLine, type PriceItem } from "./BookingItems";

/** One line of an earlier order, as the book page reads it on the server. */
export type RepeatItem = { item: string; service: ItemService | ""; quantity: number; listed?: PriceItem };
import { normalisePhone, phoneOk } from "./fields";
import { MAX_BOOKING_PHOTOS } from "@/lib/booking-photos";
import { shrinkPhoto } from "./shrink-photo";
import { submitBooking, uploadBookingPhoto, type BookingFormData, type SubmitResult } from "./submit";

type Text = FormText["booking"];
type Common = FormText["common"];

/**
 * Book a Pickup, in the order the owner set: choose services, add items with their prices,
 * your details, pickup day and time (required) with delivery date, instructions and optional
 * photos, then the order summary (estimate and the pickup & delivery charge below ৳499) and
 * Confirm. Velto then calls to confirm the pickup.
 *
 * Language: the customer sees the page language (`t`), but everything sent to Velto Ops
 * (toBookingData) is English — the area label, the pickup preference, service slugs and item
 * lines. The estimate in the Ops notes is worked out again on the server from the price list.
 */

/** Service values from a service page (?service=): the three garment services, or a household one. */
const BOOKING_SERVICES = ["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

const SECTORS = Array.from({ length: 18 }, (_, i) => i + 1);
const OUTSIDE = "outside";

const DAYS = ["today", "tomorrow", "other"] as const;
type Day = (typeof DAYS)[number];

/**
 * Preferred part of the day. No clock times: the Velto team calls to confirm the exact time.
 * `en` is what Velto Ops receives; the customer sees t.slots[id]. `end` (Dhaka hour) only
 * rules out a part of today that has already passed.
 */
const SLOTS = [
  { id: "morning", en: "Morning", end: 12 },
  { id: "afternoon", en: "Afternoon", end: 17 },
  { id: "evening", en: "Evening", end: 21 },
] as const;

/** A part of the day can still be chosen for today until an hour before it ends (Dhaka time). */
const slotOpenToday = (end: number) => (new Date().getUTCHours() + 6) % 24 < end - 1;

type Photo = { key: string; preview: string; status: "uploading" | "done" | "failed"; id?: string };

/** Orders are usually ready in about 3 days (spec §4: ~72 hours), so "back by" starts 3 days after pickup. */
const BACK_BY_DAYS = 3;

type FormState = {
  /** From a service page (?service=). A household service (curtains, carpets, blankets) stays as the booking's service. */
  service: string | null;
  /** Step 1: Dry Cleaning, Wash & Iron and/or Ironing. */
  services: GarmentService[];
  items: ItemLine[];
  sector: string;
  address: string;
  day: Day | null;
  date: string;
  slot: string;
  backBy: string;
  name: string;
  phone: string;
  notes: string;
  photos: Photo[];
};

type ErrorKey = "services" | "name" | "phone" | "sector" | "address" | "day" | "date" | "slot" | "backBy" | "photos";
type Errors = Partial<Record<ErrorKey, string>>;
type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "failed"; code: Extract<SubmitResult, { ok: false }>["code"] }
  | { state: "success"; reference?: string };

const displayPhone = (v: string) => {
  const n = normalisePhone(v);
  return /^01\d{9}$/.test(n) ? `${n.slice(0, 5)} ${n.slice(5)}` : n;
};

const isoDate = (offsetDays = 0, from?: string) => {
  const d = from ? new Date(`${from}T00:00:00`) : new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The pickup date the customer asked for, if any (ISO). */
const pickupIso = (s: FormState) => (s.day === "today" ? isoDate(0) : s.day === "tomorrow" ? isoDate(1) : s.day === "other" ? s.date : "");

/** Earliest "back by" date: about 3 days after the preferred pickup (or today). */
const earliestBackBy = (s: FormState) => isoDate(BACK_BY_DAYS, pickupIso(s) || undefined);

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

const niceDate = (iso: string, w: DateWords) => {
  const d = new Date(`${iso}T00:00:00`);
  return fill(w.dayMonth, { weekday: w.weekdays[d.getDay()], day: d.getDate(), month: w.months[d.getMonth()] }, w.locale);
};

/** Ops area label ("Uttara Sector 7"): the value Velto Ops matches on. Never localized. */
const areaLabel = (sector: string) => (sector === OUTSIDE ? "Outside Uttara Sectors 1–18" : `Uttara Sector ${sector}`);

/** The same area as the customer reads it. */
const areaText = (sector: string, t: Text, locale: Locale) =>
  sector === OUTSIDE ? t.areaOutside : fill(t.areaSector, { n: sector }, locale);

const isHousehold = (s: FormState) => Boolean(s.service && !isGarmentService(s.service));

const itemsOf = (s: FormState): BookingItem[] =>
  s.items.map((l) => ({ item: l.item, quantity: l.quantity, ...(l.service ? { service: l.service } : {}) }));

/** Ops "Service": the one all item lines share, else a household service from the page, else the one chosen service. */
const bookingService = (s: FormState) =>
  (s.items.length ? sharedItemService(itemsOf(s)) : undefined) ??
  (isHousehold(s) ? (s.service ?? undefined) : s.services.length === 1 ? s.services[0] : undefined);

const estimateOf = (s: FormState, chargeMinor: number | null) =>
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

/** One line for summaries: the items, or the chosen services. */
const whatLabel = (s: FormState, t: Text, locale: Locale) => (s.items.length ? itemsText(itemsOf(s), t, locale) : servicesText(s, t));

/**
 * Pickup day and part of the day, e.g. "Tomorrow Fri 25 Sep, Afternoon". With OPS_WORDS (and no `slots`)
 * this is the contract's preferredPickup string; the customer's version uses t.slots.
 */
function pickupLabel(s: FormState, w: DateWords = OPS_WORDS, slots?: Record<string, string>) {
  const iso = pickupIso(s);
  const prefix = s.day === "today" ? w.today : s.day === "tomorrow" ? w.tomorrow : "";
  const day = iso ? `${prefix} ${niceDate(iso, w)}`.trim() : "";
  const slot = slots ? slots[s.slot] : SLOTS.find((x) => x.id === s.slot)?.en;
  return [day, slot].filter(Boolean).join(", ");
}

const pageWords = (t: Text, c: Common, locale: Locale): DateWords => ({
  today: t.today,
  tomorrow: t.tomorrow,
  weekdays: c.weekdays,
  months: c.months,
  dayMonth: c.dayMonth,
  locale,
});

/** The Ops payload: English values only, identical whatever the page language. */
function toBookingData(s: FormState): BookingFormData {
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
    notes: s.notes.trim() || undefined,
  };
}

/** Ids of the photos that finished uploading (a failed one is simply left out). */
const uploadedPhotos = (s: FormState) => s.photos.flatMap((p) => (p.status === "done" && p.id ? [p.id] : []));

/** The estimate as one phrase for WhatsApp ("৳610"), when anything could be priced. */
const estimateLabel = (e: BookingEstimate, locale: Locale) => (e.subtotalMinor > 0 ? money(e.totalMinor, locale) : "");

/** WhatsApp fallback carries what the customer already typed (in their language), so nothing is lost. */
function whatsappHref(s: FormState, t: Text, c: Common, locale: Locale, chargeMinor: number | null) {
  const w = t.whatsapp;
  const words = pageWords(t, c, locale);
  const when = pickupLabel(s, words, t.slots);
  const estimate = estimateLabel(estimateOf(s, chargeMinor), locale);
  const lines = [
    w.greeting,
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

function validate(s: FormState, t: Text, c: Common, locale: Locale): Errors {
  const e: Errors = {};
  if (!s.services.length && !isHousehold(s)) e.services = t.errors.services;
  if (!s.name.trim()) e.name = t.errors.name;
  if (!s.phone.trim()) e.phone = c.phoneMissing;
  else if (!phoneOk(s.phone)) e.phone = c.phoneInvalid;
  if (!s.sector) e.sector = t.errors.sector;
  if (!s.address.trim()) e.address = t.errors.address;
  if (!s.day) e.day = t.errors.day;
  if (s.day === "other" && !s.date) e.date = t.errors.date;
  if (!s.slot) e.slot = t.errors.slot;
  if (s.photos.some((p) => p.status === "uploading")) e.photos = t.photosWait;
  const earliest = earliestBackBy(s);
  if (s.backBy && s.backBy < earliest) e.backBy = fill(t.errors.backBy, { date: niceDate(earliest, pageWords(t, c, locale)) }, locale);
  return e;
}

const FIELD_ORDER: ErrorKey[] = ["services", "name", "phone", "sector", "address", "day", "date", "slot", "backBy", "photos"];

/* ---------- presentational pieces (booking page only) ---------- */

const inputBase =
  "block w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy placeholder:text-secondary/80 hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error";
const inputHeight = "h-[54px] md:h-[52px]";

function Group({
  step,
  title,
  hint,
  stepOf,
  locale,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  /** "Step {n} of 4: " in the page language. */
  stepOf: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="contents">
        <span className="flex items-baseline gap-3 t-h4 text-navy">
          <span aria-hidden="true" className="w-4 shrink-0 text-action tabular-nums">
            {localDigits(step, locale)}
          </span>
          <span>
            <span className="sr-only">{fill(stepOf, { n: step }, locale)}</span>
            {title}
          </span>
        </span>
      </legend>
      {hint ? <p className="mt-1 pl-7 t-small text-secondary">{hint}</p> : null}
      <div className="mt-3.5 space-y-4">{children}</div>
    </fieldset>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[15px] font-semibold text-navy">
      {children}
    </label>
  );
}

function ErrorText({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-2 t-small font-medium text-error">
      <span aria-hidden="true">!</span>
      {children}
    </p>
  );
}

function ChoiceTiles<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  columns,
  firstId,
  error,
}: {
  name: string;
  label: string;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T | null;
  onChange: (v: T) => void;
  columns: string;
  /** id on the first choice, so a validation error can move focus here. */
  firstId?: string;
  /** id of the error text, when there is one. */
  error?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} aria-describedby={error} aria-invalid={error ? true : undefined} className={`grid gap-2 ${columns}`}>
      {options.map((o, i) => {
        const checked = value === o.value;
        return (
          <label
            key={`${name}-${o.value}`}
            className={`flex min-h-11 items-center justify-center rounded-md border px-1 py-2 text-center text-[14px] leading-tight transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue md:text-[15px] ${
              o.disabled
                ? "cursor-not-allowed border-line bg-soft text-secondary line-through decoration-secondary/60"
                : checked
                  ? "cursor-pointer border-blue bg-[#f0f7fc] font-semibold text-navy"
                  : error
                    ? "cursor-pointer border-error text-navy"
                    : "cursor-pointer border-line-strong text-navy hover:border-navy/50"
            }`}
          >
            <input
              id={i === 0 ? firstId : undefined}
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/** Step 1: one or more of the three garment services, as large checkable cards. */
function ServiceChoices({
  t,
  value,
  onChange,
  invalid,
}: {
  t: Text;
  value: GarmentService[];
  onChange: (v: GarmentService[]) => void;
  invalid: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={t.servicesTitle}
      aria-describedby={invalid ? "booking-services-error" : undefined}
      className="grid gap-2 md:grid-cols-3"
    >
      {GARMENT_SERVICES.map((slug, i) => {
        const checked = value.includes(slug);
        return (
          <label
            key={slug}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
              checked ? "border-blue bg-[#f0f7fc]" : invalid ? "border-error" : "border-line-strong hover:border-navy/50"
            }`}
          >
            <input
              id={i === 0 ? "booking-services" : undefined}
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? value.filter((x) => x !== slug) : GARMENT_SERVICES.filter((x) => x === slug || value.includes(x)))}
              aria-invalid={invalid || undefined}
              className="mt-0.5 size-5 shrink-0 accent-[#0078bc]"
            />
            <span>
              <span className="block font-semibold text-navy">{t.services[slug]}</span>
              <span className="mt-0.5 block t-small text-secondary">{t.serviceBlurbs[slug]}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** The order summary right above Confirm: items and prices, pickup & delivery, and the estimated total. */
function OrderSummary({ s, t, locale, chargeMinor }: { s: FormState; t: Text; locale: Locale; chargeMinor: number | null }) {
  const e = estimateOf(s, chargeMinor);
  const threshold = localDigits(FREE_DELIVERY_THRESHOLD, locale);
  const priced = e.subtotalMinor > 0;
  const row = "flex items-baseline justify-between gap-4 py-2";
  return (
    <section aria-labelledby="booking-summary-title" className="rounded-md border border-line bg-soft p-4 md:p-5" data-order-summary>
      <h2 id="booking-summary-title" className="t-h4 text-navy">
        {t.summaryTitle}
      </h2>
      {s.items.length ? (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {s.items.map((l) => {
            const unit = lineUnit(l);
            return (
              <li key={l.id} className={`${row} t-small`}>
                <span className="min-w-0 text-body">
                  {localDigits(l.quantity, locale)} × {l.item === MIXED_ITEM ? t.mixedItem : l.item}
                  <span className="text-secondary"> · {l.service ? t.services[l.service] : t.itemNotSure}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${unit === null ? "text-secondary" : "text-navy"}`}>
                  {unit === null ? t.items.atPickup : money(unit * l.quantity, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 t-small text-body">{t.summaryEmpty}</p>
      )}
      {priced ? (
        <dl className="mt-1">
          <div className={row}>
            <dt className="t-small text-body">{t.summaryItems}</dt>
            <dd className="t-small tabular-nums text-navy">{money(e.subtotalMinor, locale)}</dd>
          </div>
          <div className={`${row} border-b border-line`}>
            <dt className="t-small text-body">{t.summaryDelivery}</dt>
            <dd className="t-small tabular-nums text-navy">
              {e.free ? t.summaryFree : e.chargeMinor !== null ? money(e.chargeMinor, locale) : t.summaryChargeUnknown}
            </dd>
          </div>
          <div className={`${row} pt-3`}>
            <dt className="font-semibold text-navy">{t.summaryTotal}</dt>
            <dd className="text-[20px] font-semibold tabular-nums text-navy" data-estimate-total>
              {money(e.totalMinor, locale)}
            </dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-2 space-y-1.5 t-small">
        {priced && !e.free ? (
          <p className="text-navy">
            {format(t.summaryChargeNote, { amount: threshold, more: money(FREE_DELIVERY_MIN_MINOR - e.subtotalMinor, locale) })}
          </p>
        ) : !priced ? (
          <p className="text-navy">{format(t.summaryFreeNote, { amount: threshold })}</p>
        ) : null}
        {priced && e.unpricedLines ? (
          <p className="text-secondary">{e.unpricedLines === 1 ? t.summaryUnpricedOne : fill(t.summaryUnpricedMany, { n: e.unpricedLines }, locale)}</p>
        ) : null}
        <p className="text-secondary">{t.summaryNote}</p>
      </div>
    </section>
  );
}

/** Optional photos (stains, damage, delicate fabric): thumbnails with upload state, up to three. */
function PhotoPicker({
  t,
  c,
  locale,
  photos,
  onAdd,
  onRemove,
  error,
}: {
  t: Text;
  c: Common;
  locale: Locale;
  photos: Photo[];
  onAdd: (files: FileList | null) => void;
  onRemove: (key: string) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const full = photos.length >= MAX_BOOKING_PHOTOS;
  return (
    <div>
      <p className="text-[15px] font-semibold text-navy">
        {t.photosLabel}
        <span className="font-normal text-secondary">{c.optional}</span>
      </p>
      <p id="booking-photos-help" className="mt-1 t-small text-secondary">
        {fill(t.photosHelp, { max: MAX_BOOKING_PHOTOS }, locale)}
      </p>
      {photos.length ? (
        <ul className="mt-3 flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <li key={p.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL), not a site image */}
              <img
                src={p.preview}
                alt=""
                className={`size-20 rounded-md border object-cover ${p.status === "failed" ? "border-error opacity-60" : "border-line"}`}
              />
              {p.status !== "done" ? (
                <span
                  className={`absolute inset-x-0 bottom-0 rounded-b-md px-1 py-0.5 text-center text-[11px] font-semibold text-white ${
                    p.status === "failed" ? "bg-error" : "bg-navy/80"
                  }`}
                >
                  {p.status === "failed" ? t.photoFailed : t.photoUploading}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(p.key)}
                aria-label={fill(t.photoRemove, { n: i + 1 }, locale)}
                className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-line-strong bg-white text-navy shadow-sm hover:border-navy"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {photos.some((p) => p.status === "failed") ? <p className="mt-2 t-small text-navy">{t.photoRetryHint}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id="booking-photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          aria-describedby={error ? "booking-photos-help booking-photos-error" : "booking-photos-help"}
          onChange={(e) => {
            onAdd(e.target.files);
            e.target.value = "";
          }}
          disabled={full}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={full}
          className="inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
            <path
              d="M3 6.5A1.5 1.5 0 0 1 4.5 5h2l1.2-1.6A1 1 0 0 1 8.5 3h3a1 1 0 0 1 .8.4L13.5 5h2A1.5 1.5 0 0 1 17 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="10" cy="10.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {photos.length ? t.addMorePhotos : t.addPhotos}
        </button>
        <span className="t-small text-secondary">{fill(t.photosCount, { n: photos.length, max: MAX_BOOKING_PHOTOS }, locale)}</span>
      </div>
      <ErrorText id="booking-photos-error">{error}</ErrorText>
    </div>
  );
}

/**
 * Phones only: once items are added, a slim bar keeps the count and estimate in view while the
 * customer fills in the rest, and jumps to the order summary. Hidden from md up, where the
 * summary sits close to the form.
 */
function MobileTotalBar({ s, t, locale, chargeMinor }: { s: FormState; t: Text; locale: Locale; chargeMinor: number | null }) {
  // Steps aside once the summary is on screen, so it never covers the summary, Confirm or the footer.
  const [beforeSummary, setBeforeSummary] = useState(true);
  useEffect(() => {
    const summary = document.getElementById("booking-summary-title");
    if (!summary) return;
    const check = () => setBeforeSummary(summary.getBoundingClientRect().top > window.innerHeight);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  if (!s.items.length || !beforeSummary) return null;
  const e = estimateOf(s, chargeMinor);
  const count = s.items.reduce((n, l) => n + l.quantity, 0);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,49,83,0.08)] backdrop-blur md:hidden" data-total-bar>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 t-small text-body">
          {count === 1 ? t.barItemsOne : fill(t.barItems, { n: count }, locale)}
          {e.subtotalMinor > 0 ? <span className="ml-2 font-semibold tabular-nums text-navy">{money(e.totalMinor, locale)}</span> : null}
        </p>
        <a href="#booking-summary-title" className="inline-flex h-11 shrink-0 items-center rounded-md bg-action px-5 font-semibold text-white hover:bg-action-hover">
          {t.barReview}
        </a>
      </div>
    </div>
  );
}

function WhatsAppFallback({
  href,
  placement,
  label,
  opens,
  className = "",
}: {
  href: string;
  placement: string;
  label: string;
  /** " (opens WhatsApp)" in the page language. */
  opens: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="whatsapp_click"
      data-placement={placement}
      className={`inline-flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy ${className}`}
    >
      <WhatsAppIcon className="size-5 text-whatsapp" />
      {label}
      <span className="sr-only">{opens}</span>
    </a>
  );
}

/* ---------- form ---------- */

export function BookingForm({
  t,
  common: c,
  intro,
  initialService,
  presetNote,
  previewOutcome,
  initialContact,
  popularItems = [],
  pickupChargeMinor = null,
  repeatItems = [],
}: {
  /** Form text in the page language (formText(locale).booking), passed by the page. */
  t: Text;
  common: Common;
  /** Page heading copy. The form owns the h1 so the success state can replace it. */
  intro: ReactNode;
  initialService?: string;
  /** Came from Regular Pickup or Express: prefill the instructions (no separate contract field). */
  presetNote?: string;
  /** Development-only: simulates the adapter result to QA success/error UI. Never set in production. */
  previewOutcome?: "success" | "error";
  /** Signed-in customer: known details prefilled. The customer still reviews and submits. */
  initialContact?: { name: string; phone: string; address: string; sector: string };
  /** Popular items with prices from the Ops price list (server-read); empty when unavailable. */
  popularItems?: PriceItem[];
  /** Pickup & delivery charge below ৳499 from the admin, or null when not set (Velto confirms it). */
  pickupChargeMinor?: number | null;
  /** "Book the same again": the earlier order's lines, with today's price-list entry when listed (signed-in customers). */
  repeatItems?: RepeatItem[];
}) {
  const locale = useLocale();
  const [initialItems] = useState(() => repeatItems.map((r) => repeatLine(r.item, r.service, r.quantity, r.listed)));
  const service = initialService && BOOKING_SERVICES.includes(initialService) ? initialService : null;
  const [s, setS] = useState<FormState>({
    service,
    // Repeating an order: its lines, and the services they use; otherwise the page's service.
    services: initialItems.length
      ? GARMENT_SERVICES.filter((g) => initialItems.some((l) => l.service === g))
      : isGarmentService(service)
        ? [service]
        : [],
    items: initialItems,
    sector: initialContact && (SECTORS.map(String).includes(initialContact.sector) || initialContact.sector === OUTSIDE) ? initialContact.sector : "",
    address: initialContact?.address ?? "",
    day: null,
    date: "",
    slot: "",
    backBy: "",
    name: initialContact?.name ?? "",
    phone: initialContact?.phone ?? "",
    notes: presetNote ?? "",
    photos: [],
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const started = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status.state === "failed") statusRef.current?.focus();
    if (status.state === "success") {
      successRef.current?.scrollIntoView({ block: "start" });
      successRef.current?.focus({ preventScroll: true });
    }
  }, [status.state]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (!started.current) {
      started.current = true;
      track("booking_start", { section: "booking-form" });
    }
    setS((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (status.state === "failed") setStatus({ state: "idle" });
  };

  // Photo previews are object URLs: release them when the form goes away.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const setPhoto = (key: string, patch: Partial<Photo>) =>
    setS((prev) => ({ ...prev, photos: prev.photos.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));

  /** Each picked photo is shrunk and uploaded straight away; the booking carries only the ids. */
  const addPhotos = (files: FileList | null) => {
    const room = MAX_BOOKING_PHOTOS - s.photos.length;
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (!picked.length) return;
    const added: Photo[] = picked.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { key: crypto.randomUUID(), preview, status: "uploading" };
    });
    update("photos", [...s.photos, ...added]);
    setErrors((prev) => ({ ...prev, photos: undefined }));
    added.forEach((photo, i) => {
      void shrinkPhoto(picked[i])
        .then(uploadBookingPhoto)
        .then((r) => setPhoto(photo.key, r.ok ? { status: "done", id: r.id } : { status: "failed" }));
    });
  };

  const removePhoto = (key: string) => {
    const photo = s.photos.find((p) => p.key === key);
    if (photo) URL.revokeObjectURL(photo.preview);
    update(
      "photos",
      s.photos.filter((p) => p.key !== key),
    );
  };

  const checkPhoneOnBlur = () => {
    // Only nag once something has been typed.
    if (s.phone.trim() && !phoneOk(s.phone)) setErrors((prev) => ({ ...prev, phone: validate(s, t, c, locale).phone }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status.state === "submitting") return;
    const found = validate(s, t, c, locale);
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      const el = document.getElementById(`booking-${first}`);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setStatus({ state: "submitting" });

    let result: SubmitResult;
    if (previewOutcome) {
      await new Promise((r) => setTimeout(r, 700));
      result = previewOutcome === "success" ? { ok: true } : { ok: false, code: "unavailable" };
    } else {
      result = await submitBooking(toBookingData(s));
    }

    if (result.ok) {
      if (!previewOutcome) track("booking_success", { service: bookingService(s) });
      setStatus({ state: "success", reference: result.reference });
    } else {
      setStatus({ state: "failed", code: result.code });
    }
  };

  if (status.state === "success") {
    return (
      <BookingSuccess
        headingRef={successRef}
        state={s}
        reference={status.reference}
        t={t}
        c={c}
        locale={locale}
        chargeMinor={pickupChargeMinor}
      />
    );
  }

  const submitting = status.state === "submitting";
  const errorCount = Object.values(errors).filter(Boolean).length;
  const earliest = earliestBackBy(s);
  const words = pageWords(t, c, locale);

  return (
    <>
      <h1 id="page-title" className="t-h1 text-navy">
        {t.title}
      </h1>
      <p className="mt-3 t-body text-body md:mt-4 md:t-body-lg">{intro}</p>
      <div className="mt-8 md:mt-10">
        <form
          noValidate
          onSubmit={onSubmit}
          aria-labelledby="page-title"
          className="space-y-6 [&_input]:scroll-mt-32 [&_select]:scroll-mt-32 [&_textarea]:scroll-mt-32"
        >
          <Group step={1} title={t.servicesTitle} hint={isHousehold(s) ? undefined : t.servicesHint} stepOf={t.stepOf} locale={locale}>
            {isHousehold(s) ? (
              <p className="t-small text-navy">
                {t.bookingBefore}
                <span className="font-semibold">{t.services[s.service ?? ""]}</span>
                {t.bookingAfter}
              </p>
            ) : null}
            <div>
              <ServiceChoices t={t} value={s.services} onChange={(v) => update("services", v)} invalid={Boolean(errors.services)} />
              <ErrorText id="booking-services-error">{errors.services}</ErrorText>
            </div>
          </Group>

          <Group step={2} title={t.itemsTitle} hint={t.itemsHint} stepOf={t.stepOf} locale={locale}>
            <BookingItems
              t={t.items}
              services={t.services}
              mixedLabel={t.mixedItem}
              lines={s.items}
              onChange={(items) => update("items", items)}
              chosen={s.services}
              popular={popularItems}
              locale={locale}
            />
          </Group>

          <Group step={3} title={t.youTitle} stepOf={t.stepOf} locale={locale}>
            <div>
              <FieldLabel htmlFor="booking-name">{t.nameLabel}</FieldLabel>
              <input
                id="booking-name"
                name="name"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                value={s.name}
                onChange={(e) => update("name", e.target.value)}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "booking-name-error" : undefined}
                className={`${inputBase} ${inputHeight} mt-2`}
              />
              <ErrorText id="booking-name-error">{errors.name}</ErrorText>
            </div>

            <div>
              <FieldLabel htmlFor="booking-phone">{t.phoneLabel}</FieldLabel>
              <p id="booking-phone-help" className="mt-1 t-small text-secondary">
                {t.phoneHelp}
              </p>
              <input
                id="booking-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                placeholder="01XXX XXXXXX"
                value={s.phone}
                onChange={(e) => update("phone", e.target.value)}
                onBlur={checkPhoneOnBlur}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? "booking-phone-help booking-phone-error" : "booking-phone-help"}
                className={`${inputBase} ${inputHeight} mt-2`}
              />
              <ErrorText id="booking-phone-error">{errors.phone}</ErrorText>
            </div>

            <div>
              <FieldLabel htmlFor="booking-sector">{t.sectorLabel}</FieldLabel>
              <div className="relative mt-2">
                <select
                  id="booking-sector"
                  name="sector"
                  value={s.sector}
                  onChange={(e) => update("sector", e.target.value)}
                  aria-invalid={errors.sector ? true : undefined}
                  aria-describedby={errors.sector ? "booking-sector-error" : s.sector === OUTSIDE ? "booking-outside" : undefined}
                  className={`${inputBase} ${inputHeight} appearance-none pr-11`}
                >
                  <option value="" disabled>
                    {t.sectorPlaceholder}
                  </option>
                  {SECTORS.map((n) => (
                    <option key={n} value={String(n)}>
                      {fill(t.sectorOption, { n }, locale)}
                    </option>
                  ))}
                  <option value={OUTSIDE}>{t.outsideOption}</option>
                </select>
                <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-navy">
                  <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <ErrorText id="booking-sector-error">{errors.sector}</ErrorText>
              {s.sector === OUTSIDE ? (
                <p id="booking-outside" className="mt-2 t-small text-navy">
                  {t.outsideNote}
                </p>
              ) : null}
            </div>

            <div>
              <FieldLabel htmlFor="booking-address">{t.addressLabel}</FieldLabel>
              <input
                id="booking-address"
                name="address"
                type="text"
                autoComplete="address-line1"
                enterKeyHint="next"
                placeholder={t.addressPlaceholder}
                value={s.address}
                onChange={(e) => update("address", e.target.value)}
                aria-invalid={errors.address ? true : undefined}
                aria-describedby={errors.address ? "booking-address-error" : undefined}
                className={`${inputBase} ${inputHeight} mt-2`}
              />
              <ErrorText id="booking-address-error">{errors.address}</ErrorText>
            </div>
          </Group>

          <Group step={4} title={t.datesTitle} hint={t.datesHint} stepOf={t.stepOf} locale={locale}>
            <div>
              <p className="text-[15px] font-semibold text-navy">{t.dayLabel}</p>
              <div className="mt-2">
                <ChoiceTiles
                  name="day"
                  label={t.dayLabel}
                  options={DAYS.map((value) => ({ value, label: t.days[value] }))}
                  value={s.day}
                  onChange={(v) => {
                    update("day", v);
                    // A window that has already passed today can't stay chosen.
                    const slot = SLOTS.find((x) => x.id === s.slot);
                    if (v === "today" && slot && !slotOpenToday(slot.end)) update("slot", "");
                  }}
                  columns="grid-cols-3"
                  firstId="booking-day"
                  error={errors.day ? "booking-day-error" : undefined}
                />
              </div>
              <ErrorText id="booking-day-error">{errors.day}</ErrorText>
              {s.day === "other" ? (
                <div className="mt-3">
                  <FieldLabel htmlFor="booking-date">{t.dateLabel}</FieldLabel>
                  <input
                    id="booking-date"
                    name="date"
                    type="date"
                    min={isoDate(0)}
                    value={s.date}
                    onChange={(e) => update("date", e.target.value)}
                    aria-invalid={errors.date ? true : undefined}
                    aria-describedby={errors.date ? "booking-date-error" : undefined}
                    className={`${inputBase} ${inputHeight} mt-2`}
                  />
                  <ErrorText id="booking-date-error">{errors.date}</ErrorText>
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-[15px] font-semibold text-navy">{t.slotLabel}</p>
              <div className="mt-2">
                <ChoiceTiles
                  name="slot"
                  label={t.slotLabel}
                  // Only a chosen "today" rules out windows (never evaluated during server rendering).
                  options={SLOTS.map((x) => ({ value: x.id, label: t.slots[x.id], disabled: s.day === "today" && !slotOpenToday(x.end) }))}
                  value={s.slot || null}
                  onChange={(v) => update("slot", v)}
                  columns="grid-cols-3"
                  firstId="booking-slot"
                  error={errors.slot ? "booking-slot-error" : undefined}
                />
              </div>
              {s.day === "today" && SLOTS.every((x) => !slotOpenToday(x.end)) ? (
                <p className="mt-2 t-small text-navy">{t.slotsTodayNone}</p>
              ) : null}
              <ErrorText id="booking-slot-error">{errors.slot}</ErrorText>
            </div>

            <div>
              <FieldLabel htmlFor="booking-backBy">
                {t.backByLabel}
                <span className="font-normal text-secondary">{c.optional}</span>
              </FieldLabel>
              <p id="booking-backBy-help" className="mt-1 t-small text-secondary">
                {fill(t.backByHelp, { date: niceDate(earliest, words) }, locale)}
              </p>
              <input
                id="booking-backBy"
                name="backBy"
                type="date"
                min={earliest}
                value={s.backBy}
                onChange={(e) => update("backBy", e.target.value)}
                aria-invalid={errors.backBy ? true : undefined}
                aria-describedby={errors.backBy ? "booking-backBy-help booking-backBy-error" : "booking-backBy-help"}
                className={`${inputBase} ${inputHeight} mt-2`}
              />
              <ErrorText id="booking-backBy-error">{errors.backBy}</ErrorText>
            </div>

            <div>
              <FieldLabel htmlFor="booking-notes">
                {t.notesLabel}
                <span className="font-normal text-secondary">{c.optional}</span>
              </FieldLabel>
              <textarea
                id="booking-notes"
                name="notes"
                rows={3}
                // Items, the estimate and the date share the Ops notes field with the instructions.
                maxLength={Math.max(
                  0,
                  MAX_BOOKING_NOTES - NOTE_EXTRAS_RESERVE - s.photos.length * NOTE_PHOTO_RESERVE - (composeBookingNotes(itemsOf(s), "x")?.length ?? 0),
                )}
                placeholder={t.notesPlaceholder}
                value={s.notes}
                onChange={(e) => update("notes", e.target.value)}
                className={`${inputBase} mt-2 min-h-[120px] py-3 leading-[1.4]`}
              />
            </div>

            <PhotoPicker t={t} c={c} locale={locale} photos={s.photos} onAdd={addPhotos} onRemove={removePhoto} error={errors.photos} />
          </Group>

          <OrderSummary s={s} t={t} locale={locale} chargeMinor={pickupChargeMinor} />
          <MobileTotalBar s={s} t={t} locale={locale} chargeMinor={pickupChargeMinor} />

          {/* Confirm — status lives right where the thumb already is */}
          <div>
            {status.state === "failed" ? (
              <div ref={statusRef} tabIndex={-1} role="alert" className="mb-5 rounded-md border border-line-strong bg-soft p-4 focus:outline-2 focus:outline-blue">
                <p className="font-semibold text-navy">
                  {status.code === "not_connected" ? t.failedNotConnectedTitle : t.failedTitle}
                </p>
                <p className="mt-1 t-small text-body">
                  {status.code === "not_connected" ? t.failedNotConnectedBody : t.failedBody}
                </p>
                <WhatsAppFallback
                  href={whatsappHref(s, t, c, locale, pickupChargeMinor)}
                  placement="booking_error"
                  label={c.sendOnWhatsApp}
                  opens={c.opensWhatsApp}
                  className="mt-3 w-full md:w-auto"
                />
              </div>
            ) : null}

            {errorCount > 0 ? (
              <p role="status" className="mb-4 t-small font-medium text-error">
                {errorCount === 1 ? t.errorsOne : fill(t.errorsMany, { n: errorCount }, locale)}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className="inline-flex h-[54px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-md bg-action px-7 text-base font-semibold text-white hover:bg-action-hover active:bg-action-active disabled:cursor-wait disabled:opacity-85 md:h-12 md:w-auto"
            >
              {submitting ? (
                <>
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                  {c.sending}
                </>
              ) : (
                t.submit
              )}
            </button>

            <p className="mt-4 t-small text-secondary">{t.reassureTime}</p>
          </div>
        </form>
      </div>
    </>
  );
}

/* ---------- success: integration-ready, never shows an invented reference ---------- */

function BookingSuccess({
  headingRef,
  state,
  reference,
  t,
  c,
  locale,
  chargeMinor,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  state: FormState;
  reference?: string;
  t: Text;
  c: Common;
  locale: Locale;
  chargeMinor: number | null;
}) {
  const words = pageWords(t, c, locale);
  const when = pickupLabel(state, words, t.slots);
  const photos = uploadedPhotos(state).length;
  const firstName = state.name.trim().split(/\s+/)[0];
  const estimate = estimateLabel(estimateOf(state, chargeMinor), locale);
  const rows = [
    { label: state.items.length ? t.rowItems : t.rowService, value: whatLabel(state, t, locale) || t.notSpecified },
    ...(estimate ? [{ label: t.rowEstimate, value: estimate }] : []),
    { label: t.rowPickupFrom, value: `${state.address.trim()}, ${areaText(state.sector, t, locale)}` },
    { label: t.rowPreferredTime, value: when },
    ...(photos ? [{ label: t.rowPhotos, value: fill(t.photosAdded, { n: photos }, locale) }] : []),
    ...(state.backBy ? [{ label: t.rowBackBy, value: niceDate(state.backBy, words) }] : []),
    // Phone numbers keep their digits.
    { label: t.rowContact, value: displayPhone(state.phone) },
  ];

  return (
    <div data-booking-success>
      <h1 id="page-title" ref={headingRef} tabIndex={-1} className="scroll-mt-32 t-h1 text-navy focus:outline-none">
        {t.successTitle}
      </h1>
      <p className="mt-3 t-body text-body md:mt-4 md:t-body-lg">{format(t.successBody, { name: firstName })}</p>

      <dl className="mt-7 border-t border-navy">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3.5 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{r.label}</dt>
            <dd className="min-w-0 break-words t-small text-body">{r.value}</dd>
          </div>
        ))}
        {reference ? (
          <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3.5 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{t.rowReference}</dt>
            <dd className="t-small text-body">
              <span className="font-semibold text-navy">{reference}</span>
              <span className="mt-0.5 block text-secondary">{t.referenceNote}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <h2 className="mt-8 t-label uppercase text-navy">{t.nextTitle}</h2>
      <ol className="mt-3 space-y-2.5 text-body">
        {t.nextSteps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="t-label pt-[4px] text-action">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:flex-wrap md:items-center">
        <WhatsAppFallback
          href={whatsappHref(state, t, c, locale, chargeMinor)}
          placement="booking_success"
          label={t.changeOnWhatsApp}
          opens={c.opensWhatsApp}
        />
        <ButtonLink href="/" variant="secondary">
          {c.backHome}
        </ButtonLink>
      </div>
    </div>
  );
}
