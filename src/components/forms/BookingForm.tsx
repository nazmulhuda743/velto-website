"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { track } from "@/components/layout/Analytics";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL } from "@/content/site";
import {
  composeBookingNotes,
  MAX_BOOKING_NOTES,
  MIXED_ITEM,
  sharedItemService,
  type BookingItem,
} from "@/lib/booking-items";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { BookingItems, type ItemLine } from "./BookingItems";
import { normalisePhone, phoneOk } from "./fields";
import { submitBooking, type BookingFormData, type SubmitResult } from "./submit";

type Text = FormText["booking"];
type Common = FormText["common"];

/**
 * Book a Pickup — one compact form, grouped as what / where / when / who.
 * "What" is an optional list of item + service + quantity lines (BookingItems).
 * Values map onto the Ops `BookingSubmission` shape via BookingFormData;
 * submission stays behind the isolated adapter in ./submit (Codex wires it).
 *
 * Language: the customer sees the page language (`t`), but everything sent to Velto Ops
 * (toBookingData) is English — the area label, the pickup preference and service slugs.
 */

/** Service values from a service page (?service=); "" is "A mix, or not sure". */
const BOOKING_SERVICES = ["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

const SECTORS = Array.from({ length: 18 }, (_, i) => i + 1);
const OUTSIDE = "outside";

const DAYS = ["today", "tomorrow", "other"] as const;

/** Broad windows only: no specific slots are promised (none are verified). These values also go to Ops. */
const TIMES = ["Morning", "Afternoon", "Evening", "Any time"] as const;

type Day = (typeof DAYS)[number] | "";

type FormState = {
  /** From a service page (?service=): the default for new item lines, and the service when no lines are added. */
  service: string | null;
  items: ItemLine[];
  sector: string;
  address: string;
  day: Day;
  date: string;
  time: string;
  name: string;
  phone: string;
  notes: string;
};

type ErrorKey = "sector" | "address" | "day" | "date" | "name" | "phone";
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

const isoDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Words for the pickup preference: English for Ops, or the page language for the customer. */
type PickupWords = {
  today: string;
  tomorrow: string;
  weekdays: readonly string[];
  months: readonly string[];
  dayMonth: string;
  timesInline: Record<string, string>;
  locale: Locale;
};

/** What Velto Ops receives, whatever the page language. */
const OPS_WORDS: PickupWords = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  dayMonth: "{weekday} {day} {month}",
  timesInline: { Morning: "morning", Afternoon: "afternoon", Evening: "evening", "Any time": "any time" },
  locale: "en",
};

const niceDate = (iso: string, w: PickupWords) => {
  const d = new Date(`${iso}T00:00:00`);
  return fill(w.dayMonth, { weekday: w.weekdays[d.getDay()], day: d.getDate(), month: w.months[d.getMonth()] }, w.locale);
};

/** Ops area label ("Uttara Sector 7"): the value Velto Ops matches on. Never localized. */
const areaLabel = (sector: string) => (sector === OUTSIDE ? "Outside Uttara Sectors 1–18" : `Uttara Sector ${sector}`);

/** The same area as the customer reads it. */
const areaText = (sector: string, t: Text, locale: Locale) =>
  sector === OUTSIDE ? t.areaOutside : fill(t.areaSector, { n: sector }, locale);

const serviceLabel = (value: string | null, t: Text) => (value === null ? "" : (t.services[value] ?? ""));

const itemsOf = (s: FormState): BookingItem[] =>
  s.items.map((l) => ({ item: l.item, quantity: l.quantity, ...(l.service ? { service: l.service } : {}) }));

/** With item lines, the Ops service is the one they all share (none for a mix); otherwise the page's service. */
const bookingService = (s: FormState) => (s.items.length ? sharedItemService(itemsOf(s)) : s.service || undefined);

/** Item lines as the customer reads them; in English exactly bookingItemsText (what Ops gets in the notes). */
const itemsText = (items: BookingItem[], t: Text, locale: Locale) =>
  items
    .map(
      (i) =>
        `${localDigits(i.quantity, locale)} × ${i.item === MIXED_ITEM ? t.mixedItem : i.item} – ${i.service ? t.services[i.service] : t.itemNotSure}`,
    )
    .join("; ");

/** One line for summaries: the items, or the page's service. */
const whatLabel = (s: FormState, t: Text, locale: Locale) =>
  s.items.length ? itemsText(itemsOf(s), t, locale) : serviceLabel(s.service, t);

/**
 * Human-readable preference, e.g. "Tomorrow Fri 25 Sep, evening". With OPS_WORDS this is the
 * contract's single preferredPickup string; with the page's words, what the customer sees.
 */
function pickupLabel(s: FormState, w: PickupWords = OPS_WORDS) {
  const iso = s.day === "today" ? isoDate(0) : s.day === "tomorrow" ? isoDate(1) : s.day === "other" ? s.date : "";
  const prefix = s.day === "today" ? w.today : s.day === "tomorrow" ? w.tomorrow : "";
  const day = iso ? `${prefix} ${niceDate(iso, w)}`.trim() : "";
  const time = s.time && s.time !== "Any time" ? w.timesInline[s.time] : s.time === "Any time" && day ? w.timesInline["Any time"] : "";
  return [day, time].filter(Boolean).join(", ");
}

const pageWords = (t: Text, c: Common, locale: Locale): PickupWords => ({
  today: t.today,
  tomorrow: t.tomorrow,
  weekdays: c.weekdays,
  months: c.months,
  dayMonth: c.dayMonth,
  timesInline: t.timesInline,
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
    ...(s.items.length ? { items: itemsOf(s) } : {}),
    notes: s.notes.trim() || undefined,
  };
}

/** WhatsApp fallback carries what the customer already typed (in their language), so nothing is lost. */
function whatsappHref(s: FormState, t: Text, c: Common, locale: Locale) {
  const w = t.whatsapp;
  const when = pickupLabel(s, pageWords(t, c, locale));
  const lines = [
    w.greeting,
    s.items.length
      ? format(w.items, { v: itemsText(itemsOf(s), t, locale) })
      : s.service
        ? format(w.service, { v: serviceLabel(s.service, t) })
        : "",
    s.sector ? format(w.area, { v: areaText(s.sector, t, locale) }) : "",
    s.address.trim() ? format(w.address, { v: s.address.trim() }) : "",
    when ? format(w.pickup, { v: when }) : "",
    s.name.trim() ? format(w.name, { v: s.name.trim() }) : "",
    s.notes.trim() ? format(w.note, { v: s.notes.trim() }) : "",
  ].filter(Boolean);
  return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function validate(s: FormState, t: Text, c: Common): Errors {
  const e: Errors = {};
  if (!s.sector) e.sector = t.errors.sector;
  if (!s.address.trim()) e.address = t.errors.address;
  if (!s.day) e.day = t.errors.day;
  if (s.day === "other" && !s.date) e.date = t.errors.date;
  if (!s.name.trim()) e.name = t.errors.name;
  if (!s.phone.trim()) e.phone = c.phoneMissing;
  else if (!phoneOk(s.phone)) e.phone = c.phoneInvalid;
  return e;
}

const FIELD_ORDER: ErrorKey[] = ["sector", "address", "day", "date", "name", "phone"];

/* ---------- presentational pieces (booking page only) ---------- */

const inputBase =
  "block w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy placeholder:text-secondary/80 hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error";
const inputHeight = "h-[54px] md:h-[52px]";

/** S4: the form really is four groups, so show it. Each step fills in as it's answered. */
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
  segmented = false,
  firstId,
  describedBy,
  invalid = false,
}: {
  name: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns: string;
  /** Compact single-row choices: centred text, radio kept for accessibility but visually hidden. */
  segmented?: boolean;
  /** id on the first radio so validation can focus the group. */
  firstId?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`grid gap-2 ${columns}`}
    >
      {options.map((o, i) => {
        const checked = value === o.value;
        return (
          <label
            key={`${name}-${o.value || "none"}`}
            className={`flex min-h-11 cursor-pointer items-center rounded-md border py-2 leading-tight text-navy transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
              segmented ? "justify-center px-1 text-center text-[14px] md:text-[15px]" : "gap-3 px-3.5 text-[15px]"
            } ${checked ? "border-blue bg-[#f0f7fc] font-semibold" : invalid ? "border-error" : "border-line-strong hover:border-navy/50"}`}
          >
            <input
              id={i === 0 ? firstId : undefined}
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className={segmented ? "sr-only" : "size-4 shrink-0 accent-[#0078bc]"}
            />
            {o.label}
          </label>
        );
      })}
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
}: {
  /** Form text in the page language (formText(locale).booking), passed by the page. */
  t: Text;
  common: Common;
  /** Page heading copy. The form owns the h1 so the success state can replace it. */
  intro: ReactNode;
  initialService?: string;
  /** Came from Regular Pickup or Express: prefill and open the note (no separate contract field). */
  presetNote?: string;
  /** Development-only: simulates the adapter result to QA success/error UI. Never set in production. */
  previewOutcome?: "success" | "error";
  /** Signed-in customer: known details prefilled. The customer still reviews and submits. */
  initialContact?: { name: string; phone: string; address: string; sector: string };
}) {
  const locale = useLocale();
  const [s, setS] = useState<FormState>({
    service: initialService && BOOKING_SERVICES.includes(initialService) ? initialService : null,
    items: [],
    sector: initialContact && (SECTORS.map(String).includes(initialContact.sector) || initialContact.sector === OUTSIDE) ? initialContact.sector : "",
    address: initialContact?.address ?? "",
    day: "",
    date: "",
    time: "",
    name: initialContact?.name ?? "",
    phone: initialContact?.phone ?? "",
    notes: presetNote ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [notesOpen, setNotesOpen] = useState(Boolean(presetNote));
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
    if (s.phone.trim() && !phoneOk(s.phone)) setErrors((prev) => ({ ...prev, phone: validate(s, t, c).phone }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status.state === "submitting") return;
    const found = validate(s, t, c);
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
    return <BookingSuccess headingRef={successRef} state={s} reference={status.reference} t={t} c={c} locale={locale} />;
  }

  const submitting = status.state === "submitting";
  const errorCount = Object.values(errors).filter(Boolean).length;

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
            s.items.length > 0 || s.service !== null,
            Boolean(s.sector && s.address.trim()),
            Boolean(s.day && (s.day !== "other" || s.date)),
            Boolean(s.name.trim() && phoneOk(s.phone)),
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
          <Group step={1} title={t.whatTitle} stepOf={t.stepOf} locale={locale}>
            {s.service && !s.items.length ? (
              <p className="t-small text-navy">
                {t.bookingBefore}
                <span className="font-semibold">{serviceLabel(s.service, t)}</span>
                {t.bookingAfter}
              </p>
            ) : null}
            <BookingItems
              t={t.items}
              services={t.services}
              mixedLabel={t.mixedItem}
              lines={s.items}
              onChange={(items) => update("items", items)}
              preferredService={s.service ?? undefined}
            />
          </Group>

          <Group step={2} title={t.whereTitle} stepOf={t.stepOf} locale={locale}>
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

          <Group step={3} title={t.whenTitle} hint={t.whenHint} stepOf={t.stepOf} locale={locale}>
            <div>
              <ChoiceTiles
                name="day"
                label={t.dayLabel}
                options={DAYS.map((value) => ({ value, label: t.days[value] }))}
                value={s.day || null}
                onChange={(v) => update("day", v)}
                columns="grid-cols-3"
                segmented
                firstId="booking-day"
                invalid={Boolean(errors.day)}
                describedBy={errors.day ? "booking-day-error" : undefined}
              />
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
            <ChoiceTiles
              name="time"
              label={t.timeLabel}
              options={TIMES.map((value) => ({ value, label: t.times[value] }))}
              value={s.time || null}
              onChange={(v) => update("time", v)}
              columns="grid-cols-4"
              segmented
            />
          </Group>

          <Group step={4} title={t.youTitle} stepOf={t.stepOf} locale={locale}>
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
                enterKeyHint="done"
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

            {notesOpen ? (
              <div>
                <FieldLabel htmlFor="booking-notes">
                  {t.notesLabel}
                  <span className="font-normal text-secondary">{c.optional}</span>
                </FieldLabel>
                <textarea
                  id="booking-notes"
                  name="notes"
                  rows={3}
                  // Items and the note share the Ops notes field.
                  maxLength={Math.max(0, MAX_BOOKING_NOTES - (composeBookingNotes(itemsOf(s), "x")?.length ?? 0))}
                  placeholder={t.notesPlaceholder}
                  value={s.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  className={`${inputBase} mt-2 min-h-[96px] py-3 leading-[1.4]`}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                aria-expanded={false}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-navy underline decoration-blue/60 underline-offset-[6px] hover:decoration-blue"
              >
                <span aria-hidden="true" className="text-blue no-underline">
                  +
                </span>
                {t.addNote}
              </button>
            )}
          </Group>

          {/* Submit — status lives right where the thumb already is */}
          <div className="border-t border-line pt-6">
            {status.state === "failed" ? (
              <div ref={statusRef} tabIndex={-1} role="alert" className="mb-5 rounded-md border border-line-strong bg-soft p-4 focus:outline-2 focus:outline-blue">
                <p className="font-semibold text-navy">
                  {status.code === "not_connected" ? t.failedNotConnectedTitle : t.failedTitle}
                </p>
                <p className="mt-1 t-small text-body">
                  {status.code === "not_connected" ? t.failedNotConnectedBody : t.failedBody}
                </p>
                <WhatsAppFallback
                  href={whatsappHref(s, t, c, locale)}
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

            <ul className="mt-4 space-y-1.5 t-small text-secondary">
              <li>{t.reassureTime}</li>
              <li>{fill(t.reassureFree, { amount: FREE_DELIVERY_THRESHOLD }, locale)}</li>
            </ul>
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
}: {
  headingRef: Ref<HTMLHeadingElement>;
  state: FormState;
  reference?: string;
  t: Text;
  c: Common;
  locale: Locale;
}) {
  const when = pickupLabel(state, pageWords(t, c, locale));
  const firstName = state.name.trim().split(/\s+/)[0];
  const rows = [
    { label: state.items.length ? t.rowItems : t.rowService, value: whatLabel(state, t, locale) || t.notSpecified },
    { label: t.rowPickupFrom, value: `${state.address.trim()}, ${areaText(state.sector, t, locale)}` },
    { label: t.rowPreferredTime, value: when ? when.charAt(0).toUpperCase() + when.slice(1) : t.noPreference },
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
            <span className="t-label pt-[4px] text-blue">{localDigits(String(i + 1).padStart(2, "0"), locale)}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:flex-wrap md:items-center">
        <WhatsAppFallback
          href={whatsappHref(state, t, c, locale)}
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
