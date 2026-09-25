"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { track } from "@/components/layout/Analytics";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { FREE_DELIVERY_THRESHOLD, WHATSAPP_URL } from "@/content/site";
import {
  bookingItemsText,
  composeBookingNotes,
  MAX_BOOKING_NOTES,
  sharedItemService,
  type BookingItem,
} from "@/lib/booking-items";
import { BookingItems, type ItemLine } from "./BookingItems";
import { normalisePhone, phoneOk } from "./fields";
import { submitBooking, type BookingFormData, type SubmitResult } from "./submit";

/**
 * Book a Pickup — one compact form, grouped as what / where / when / who.
 * "What" is an optional list of item + service + quantity lines (BookingItems).
 * Values map onto the Ops `BookingSubmission` shape via BookingFormData;
 * submission stays behind the isolated adapter in ./submit (Codex wires it).
 */

export const BOOKING_SERVICES = [
  { value: "dry-cleaning", label: "Dry Cleaning" },
  { value: "wash-and-iron", label: "Wash & Iron" },
  { value: "ironing", label: "Ironing" },
  { value: "curtain-cleaning", label: "Curtains" },
  { value: "carpet-cleaning", label: "Carpets" },
  { value: "blanket-comforter-cleaning", label: "Blankets & Comforters" },
  { value: "", label: "A mix, or not sure" },
] as const;

const SECTORS = Array.from({ length: 18 }, (_, i) => i + 1);
const OUTSIDE = "outside";

const DAYS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "other", label: "Another day" },
] as const;

/** Broad windows only: no specific slots are promised (none are verified). */
const TIMES = [
  { value: "Morning", label: "Morning" },
  { value: "Afternoon", label: "Afternoon" },
  { value: "Evening", label: "Evening" },
  { value: "Any time", label: "Any time" },
] as const;

type Day = (typeof DAYS)[number]["value"] | "";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const areaLabel = (sector: string) => (sector === OUTSIDE ? "Outside Uttara Sectors 1–18" : `Uttara Sector ${sector}`);

const serviceLabel = (value: string | null) =>
  value === null ? "" : (BOOKING_SERVICES.find((s) => s.value === value)?.label ?? "");

const itemsOf = (s: FormState): BookingItem[] =>
  s.items.map((l) => ({ item: l.item, quantity: l.quantity, ...(l.service ? { service: l.service } : {}) }));

/** With item lines, the Ops service is the one they all share (none for a mix); otherwise the page's service. */
const bookingService = (s: FormState) => (s.items.length ? sharedItemService(itemsOf(s)) : s.service || undefined);

/** One line for summaries: the items, or the page's service. */
const whatLabel = (s: FormState) => (s.items.length ? bookingItemsText(itemsOf(s)) : serviceLabel(s.service));

/** Human-readable preference, e.g. "Tomorrow Fri 25 Sep, evening". Sent as the contract's single preferredPickup string. */
function pickupLabel(s: FormState) {
  const iso = s.day === "today" ? isoDate(0) : s.day === "tomorrow" ? isoDate(1) : s.day === "other" ? s.date : "";
  const prefix = s.day === "today" ? "Today" : s.day === "tomorrow" ? "Tomorrow" : "";
  const day = iso ? `${prefix} ${niceDate(iso)}`.trim() : "";
  const time = s.time && s.time !== "Any time" ? s.time.toLowerCase() : s.time === "Any time" && day ? "any time" : "";
  return [day, time].filter(Boolean).join(", ");
}

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

/** WhatsApp fallback carries what the customer already typed, so nothing is lost. */
function whatsappHref(s: FormState) {
  const lines = [
    "Hi Velto, I'd like to book a pickup.",
    s.items.length ? `Items: ${bookingItemsText(itemsOf(s))}` : s.service ? `Service: ${serviceLabel(s.service)}` : "",
    s.sector ? `Area: ${areaLabel(s.sector)}` : "",
    s.address.trim() ? `Address: ${s.address.trim()}` : "",
    pickupLabel(s) ? `Preferred pickup: ${pickupLabel(s)}` : "",
    s.name.trim() ? `Name: ${s.name.trim()}` : "",
    s.notes.trim() ? `Note: ${s.notes.trim()}` : "",
  ].filter(Boolean);
  return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function validate(s: FormState): Errors {
  const e: Errors = {};
  if (!s.sector) e.sector = "Choose your sector.";
  if (!s.address.trim()) e.address = "Add your house and road so we can find you.";
  if (!s.day) e.day = "Choose a pickup day.";
  if (s.day === "other" && !s.date) e.date = "Pick a date, or choose Today or Tomorrow.";
  if (!s.name.trim()) e.name = "Add your name.";
  if (!s.phone.trim()) e.phone = "Add a number we can call or WhatsApp.";
  else if (!phoneOk(s.phone)) e.phone = "Check the number. It should look like 01XXX XXXXXX.";
  return e;
}

const FIELD_ORDER: ErrorKey[] = ["sector", "address", "day", "date", "name", "phone"];

/* ---------- presentational pieces (booking page only) ---------- */

const inputBase =
  "block w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy placeholder:text-secondary/80 hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error";
const inputHeight = "h-[54px] md:h-[52px]";

const STEPS = ["What", "Where", "When", "You"] as const;

/** S4: the form really is four groups, so show it. Each step fills in as it's answered. */
function StepProgress({ done }: { done: boolean[] }) {
  return (
    <ol aria-label="Booking steps" className="grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={`border-t-2 pt-2 t-label transition-colors duration-200 motion-reduce:transition-none ${
            done[i] ? "border-action text-navy" : "border-line text-secondary"
          }`}
        >
          <span className="tabular-nums">{i + 1}</span> {label}
          <span className="sr-only">{done[i] ? ", done" : ", to do"}</span>
        </li>
      ))}
    </ol>
  );
}

function Group({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="contents">
        <span className="flex items-baseline gap-3 t-h4 text-navy">
          <span aria-hidden="true" className="w-4 shrink-0 text-action tabular-nums">
            {step}
          </span>
          <span>
            <span className="sr-only">Step {step} of 4: </span>
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

function WhatsAppFallback({ href, placement, label, className = "" }: { href: string; placement: string; label: string; className?: string }) {
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
      <span className="sr-only"> (opens WhatsApp)</span>
    </a>
  );
}

/* ---------- form ---------- */

export function BookingForm({
  intro,
  initialService,
  presetNote,
  previewOutcome,
  initialContact,
}: {
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
  const [s, setS] = useState<FormState>({
    service: BOOKING_SERVICES.some((o) => o.value !== "" && o.value === initialService) ? initialService! : null,
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
    if (s.phone.trim() && !phoneOk(s.phone)) setErrors((prev) => ({ ...prev, phone: validate(s).phone }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status.state === "submitting") return;
    const found = validate(s);
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
    return <BookingSuccess headingRef={successRef} state={s} reference={status.reference} />;
  }

  const submitting = status.state === "submitting";
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <h1 id="page-title" className="t-h1 text-navy">
        Book a pickup
      </h1>
      <p className="mt-3 t-body text-body md:mt-4 md:t-body-lg">{intro}</p>
      <div className="mt-6 md:mt-8">
        <StepProgress
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
          <Group step={1} title="What needs cleaning?">
            {s.service && !s.items.length ? (
              <p className="t-small text-navy">
                Booking <span className="font-semibold">{serviceLabel(s.service)}</span>. Add items below if you like, or just continue.
              </p>
            ) : null}
            <BookingItems lines={s.items} onChange={(items) => update("items", items)} preferredService={s.service ?? undefined} />
          </Group>

          <Group step={2} title="Where should we collect from?">
            <div>
              <FieldLabel htmlFor="booking-sector">Sector</FieldLabel>
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
                    Choose your sector in Uttara
                  </option>
                  {SECTORS.map((n) => (
                    <option key={n} value={String(n)}>
                      Sector {n}
                    </option>
                  ))}
                  <option value={OUTSIDE}>Outside Sectors 1–18</option>
                </select>
                <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-navy">
                  <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <ErrorText id="booking-sector-error">{errors.sector}</ErrorText>
              {s.sector === OUTSIDE ? (
                <p id="booking-outside" className="mt-2 t-small text-navy">
                  We collect across Uttara Sectors 1–18. Outside that area we need to check first, so we&apos;ll
                  confirm before promising a pickup.
                </p>
              ) : null}
            </div>

            <div>
              <FieldLabel htmlFor="booking-address">House and road</FieldLabel>
              <input
                id="booking-address"
                name="address"
                type="text"
                autoComplete="address-line1"
                enterKeyHint="next"
                placeholder="e.g. House 12, Road 7"
                value={s.address}
                onChange={(e) => update("address", e.target.value)}
                aria-invalid={errors.address ? true : undefined}
                aria-describedby={errors.address ? "booking-address-error" : undefined}
                className={`${inputBase} ${inputHeight} mt-2`}
              />
              <ErrorText id="booking-address-error">{errors.address}</ErrorText>
            </div>
          </Group>

          <Group step={3} title="When suits you?" hint="We'll confirm the exact time with you.">
            <div>
              <ChoiceTiles
                name="day"
                label="Pickup day"
                options={DAYS}
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
                  <FieldLabel htmlFor="booking-date">Date</FieldLabel>
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
              label="Pickup time"
              options={TIMES}
              value={s.time || null}
              onChange={(v) => update("time", v)}
              columns="grid-cols-4"
              segmented
            />
          </Group>

          <Group step={4} title="Your details">
            <div>
              <FieldLabel htmlFor="booking-name">Name</FieldLabel>
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
              <FieldLabel htmlFor="booking-phone">Phone or WhatsApp</FieldLabel>
              <p id="booking-phone-help" className="mt-1 t-small text-secondary">
                We&apos;ll use this to confirm your pickup.
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
                  Note for Velto<span className="font-normal text-secondary">, optional</span>
                </FieldLabel>
                <textarea
                  id="booking-notes"
                  name="notes"
                  rows={3}
                  // Items and the note share the Ops notes field.
                  maxLength={Math.max(0, MAX_BOOKING_NOTES - (composeBookingNotes(itemsOf(s), "x")?.length ?? 0))}
                  placeholder="e.g. a saree with a stain, or call when you arrive"
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
                Add a note
              </button>
            )}
          </Group>

          {/* Submit — status lives right where the thumb already is */}
          <div className="border-t border-line pt-6">
            {status.state === "failed" ? (
              <div ref={statusRef} tabIndex={-1} role="alert" className="mb-5 rounded-md border border-line-strong bg-soft p-4 focus:outline-2 focus:outline-blue">
                <p className="font-semibold text-navy">
                  {status.code === "not_connected" ? "Online booking isn't switched on yet." : "We couldn't send your booking just now."}
                </p>
                <p className="mt-1 t-small text-body">
                  {status.code === "not_connected"
                    ? "Nothing was sent. Send the same details on WhatsApp instead. They're already filled in."
                    : "Nothing is lost. Try again, or send the same details on WhatsApp."}
                </p>
                <WhatsAppFallback href={whatsappHref(s)} placement="booking_error" label="Send on WhatsApp" className="mt-3 w-full md:w-auto" />
              </div>
            ) : null}

            {errorCount > 0 ? (
              <p role="status" className="mb-4 t-small font-medium text-error">
                {errorCount === 1 ? "One thing needs checking above." : `${errorCount} things need checking above.`}
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
                  Sending…
                </>
              ) : (
                "Send Pickup Request"
              )}
            </button>

            <ul className="mt-4 space-y-1.5 t-small text-secondary">
              <li>Nothing to pay now. We call or WhatsApp you to confirm the time before we come.</li>
              <li>Free pickup &amp; delivery on orders of {FREE_DELIVERY_THRESHOLD}+.</li>
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
}: {
  headingRef: Ref<HTMLHeadingElement>;
  state: FormState;
  reference?: string;
}) {
  const when = pickupLabel(state);
  const firstName = state.name.trim().split(/\s+/)[0];
  const rows = [
    { label: state.items.length ? "Items" : "Service", value: whatLabel(state) || "Not specified" },
    { label: "Pickup from", value: `${state.address.trim()}, ${areaLabel(state.sector)}` },
    { label: "Preferred time", value: when ? when.charAt(0).toUpperCase() + when.slice(1) : "No preference" },
    { label: "We'll contact", value: displayPhone(state.phone) },
  ];

  return (
    <div data-booking-success>
      <h1 id="page-title" ref={headingRef} tabIndex={-1} className="scroll-mt-32 t-h1 text-navy focus:outline-none">
        Pickup request received
      </h1>
      <p className="mt-3 t-body text-body md:mt-4 md:t-body-lg">
        Thanks, {firstName}. We&apos;ll call or WhatsApp you to confirm the pickup time. Your pickup is booked once we&apos;ve confirmed it with you.
      </p>

      <dl className="mt-7 border-t border-navy">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3.5 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">{r.label}</dt>
            <dd className="min-w-0 break-words t-small text-body">{r.value}</dd>
          </div>
        ))}
        {reference ? (
          <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-line py-3.5 md:grid-cols-[10rem_1fr]">
            <dt className="t-small font-semibold text-navy">Reference</dt>
            <dd className="t-small text-body">
              <span className="font-semibold text-navy">{reference}</span>
              <span className="mt-0.5 block text-secondary">Mention this if you contact us about the pickup.</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <h2 className="mt-8 t-label uppercase text-navy">What happens next</h2>
      <ol className="mt-3 space-y-2.5 text-body">
        {[
          "We call or WhatsApp you to confirm the pickup time.",
          "We collect from your door.",
          "Your order comes back cleaned, finished, checked and packed.",
        ].map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="t-label pt-[4px] text-blue">{String(i + 1).padStart(2, "0")}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:flex-wrap md:items-center">
        <WhatsAppFallback href={whatsappHref(state)} placement="booking_success" label="Change something on WhatsApp" />
        <ButtonLink href="/" variant="secondary">
          Back to the homepage
        </ButtonLink>
      </div>
    </div>
  );
}
