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
  sharedItemService,
  type BookingEstimate,
  type BookingItem,
  type GarmentService,
} from "@/lib/booking-items";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { BookingItems, lineUnit, money, type ItemLine, type PriceItem } from "./BookingItems";
import { normalisePhone, phoneOk } from "./fields";
import { submitBooking, type BookingFormData, type SubmitResult } from "./submit";

type Text = FormText["booking"];
type Common = FormText["common"];

/**
 * Book a Pickup, in the order the owner set: choose services, add items with their prices,
 * your details, pickup and delivery dates with instructions, then the order summary (estimate
 * and the pickup & delivery charge below ৳499) and Confirm. Velto then calls to confirm a
 * pickup time slot.
 *
 * Language: the customer sees the page language (`t`), but everything sent to Velto Ops
 * (toBookingData) is English — the area label, the pickup preference, service slugs and item
 * lines. The estimate in the Ops notes is worked out again on the server from the price list.
 */

/** Service values from a service page (?service=): the three garment services, or a household one. */
const BOOKING_SERVICES = ["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

const SECTORS = Array.from({ length: 18 }, (_, i) => i + 1);
const OUTSIDE = "outside";

const DAYS = ["any", "today", "tomorrow", "other"] as const;
type Day = (typeof DAYS)[number];

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
  day: Day;
  date: string;
  backBy: string;
  name: string;
  phone: string;
  notes: string;
};

type ErrorKey = "services" | "name" | "phone" | "sector" | "address" | "date" | "backBy";
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

/** Preferred pickup day, e.g. "Tomorrow Fri 25 Sep". With OPS_WORDS this is the contract's preferredPickup string. */
function pickupLabel(s: FormState, w: DateWords = OPS_WORDS) {
  const iso = pickupIso(s);
  const prefix = s.day === "today" ? w.today : s.day === "tomorrow" ? w.tomorrow : "";
  return iso ? `${prefix} ${niceDate(iso, w)}`.trim() : "";
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
    preferredPickup: pickupLabel(s) || undefined,
    service: bookingService(s),
    ...(s.services.length ? { services: s.services } : {}),
    ...(s.items.length ? { items: itemsOf(s) } : {}),
    ...(s.backBy ? { deliveryBy: s.backBy } : {}),
    notes: s.notes.trim() || undefined,
  };
}

/** The estimate as one phrase for WhatsApp ("৳610"), when anything could be priced. */
const estimateLabel = (e: BookingEstimate, locale: Locale) => (e.subtotalMinor > 0 ? money(e.totalMinor, locale) : "");

/** WhatsApp fallback carries what the customer already typed (in their language), so nothing is lost. */
function whatsappHref(s: FormState, t: Text, c: Common, locale: Locale, chargeMinor: number | null) {
  const w = t.whatsapp;
  const words = pageWords(t, c, locale);
  const when = pickupLabel(s, words);
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
  if (s.day === "other" && !s.date) e.date = t.errors.date;
  const earliest = earliestBackBy(s);
  if (s.backBy && s.backBy < earliest) e.backBy = fill(t.errors.backBy, { date: niceDate(earliest, pageWords(t, c, locale)) }, locale);
  return e;
}

const FIELD_ORDER: ErrorKey[] = ["services", "name", "phone", "sector", "address", "date", "backBy"];

/* ---------- presentational pieces (booking page only) ---------- */

const inputBase =
  "block w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy placeholder:text-secondary/80 hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error";
const inputHeight = "h-[54px] md:h-[52px]";

/** The form really is four groups, so show it. Each step fills in as it's answered. */
function StepProgress({ done, t, locale }: { done: boolean[]; t: Text; locale: Locale }) {
  return (
    <ol aria-label={t.stepsAria} className="grid grid-cols-4 gap-2">
      {t.steps.map((label, i) => (
        <li
          key={label}
          className={`border-t-2 pt-2 t-label transition-colors duration-200 motion-reduce:transition-none ${
            done[i] ? "border-action text-navy" : "border-line text-secondary"
          }`}
        >
          <span className="tabular-nums">{localDigits(i + 1, locale)}</span> {label}
          <span className="sr-only">{done[i] ? t.stepDone : t.stepTodo}</span>
        </li>
      ))}
    </ol>
  );
}

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
}: {
  name: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${columns}`}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={`${name}-${o.value}`}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-1 py-2 text-center text-[14px] leading-tight text-navy transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue md:text-[15px] ${
              checked ? "border-blue bg-[#f0f7fc] font-semibold" : "border-line-strong hover:border-navy/50"
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
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
}) {
  const locale = useLocale();
  const service = initialService && BOOKING_SERVICES.includes(initialService) ? initialService : null;
  const [s, setS] = useState<FormState>({
    service,
    services: isGarmentService(service) ? [service] : [],
    items: [],
    sector: initialContact && (SECTORS.map(String).includes(initialContact.sector) || initialContact.sector === OUTSIDE) ? initialContact.sector : "",
    address: initialContact?.address ?? "",
    day: "any",
    date: "",
    backBy: "",
    name: initialContact?.name ?? "",
    phone: initialContact?.phone ?? "",
    notes: presetNote ?? "",
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
      <div className="mt-6 md:mt-8">
        <StepProgress
          t={t}
          locale={locale}
          done={[
            s.services.length > 0 || isHousehold(s),
            s.items.length > 0,
            Boolean(s.name.trim() && phoneOk(s.phone) && s.sector && s.address.trim()),
            s.day !== "any" || Boolean(s.backBy || s.notes.trim()),
          ]}
        />
      </div>
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
              <p className="text-[15px] font-semibold text-navy">
                {t.dayLabel}
                <span className="font-normal text-secondary">{c.optional}</span>
              </p>
              <div className="mt-2">
                <ChoiceTiles
                  name="day"
                  label={t.dayLabel}
                  options={DAYS.map((value) => ({ value, label: t.days[value] }))}
                  value={s.day}
                  onChange={(v) => update("day", v)}
                  columns="grid-cols-2 min-[400px]:grid-cols-4"
                />
              </div>
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
                maxLength={Math.max(0, MAX_BOOKING_NOTES - NOTE_EXTRAS_RESERVE - (composeBookingNotes(itemsOf(s), "x")?.length ?? 0))}
                placeholder={t.notesPlaceholder}
                value={s.notes}
                onChange={(e) => update("notes", e.target.value)}
                className={`${inputBase} mt-2 min-h-[120px] py-3 leading-[1.4]`}
              />
            </div>
          </Group>

          <OrderSummary s={s} t={t} locale={locale} chargeMinor={pickupChargeMinor} />

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
  const when = pickupLabel(state, words);
  const firstName = state.name.trim().split(/\s+/)[0];
  const estimate = estimateLabel(estimateOf(state, chargeMinor), locale);
  const rows = [
    { label: state.items.length ? t.rowItems : t.rowService, value: whatLabel(state, t, locale) || t.notSpecified },
    ...(estimate ? [{ label: t.rowEstimate, value: estimate }] : []),
    { label: t.rowPickupFrom, value: `${state.address.trim()}, ${areaText(state.sector, t, locale)}` },
    { label: t.rowPreferredTime, value: when || t.noPreference },
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
