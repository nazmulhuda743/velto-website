"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { track } from "@/components/layout/Analytics";
import type { NotifyText } from "@/content/i18n/notify";
import { FREE_DELIVERY_THRESHOLD } from "@/content/site";
import {
  composeBookingNotes,
  GARMENT_SERVICES,
  isGarmentService,
  MAX_BOOKING_NOTES,
  NOTE_EXTRAS_RESERVE,
  NOTE_PHOTO_RESERVE,
  type GarmentService,
  type ItemService,
} from "@/lib/booking-items";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import type { UpsellHints } from "@/lib/booking-upsell";
import { BookingItems, repeatLine, type ItemLine, type PriceItem } from "./BookingItems";

/** One line of an earlier order, as the book page reads it on the server. */
export type RepeatItem = { item: string; service: ItemService | ""; quantity: number; listed?: PriceItem };
import { phoneOk, RequiredNote, SelectField, TextField } from "./fields";
import { MAX_BOOKING_PHOTOS } from "@/lib/booking-photos";
import { shrinkPhoto } from "./shrink-photo";
import { PickupWindows, type PickedWindow } from "./PickupWindows";
import { submitBooking, uploadBookingPhoto, type SubmitResult } from "./submit";
import { CallbackRequest } from "./CallbackRequest";
import { useNightDhaka } from "./useNight";
import { DRAFT_KEY, makeDraft, readDraft, type BookingDraft } from "@/lib/booking-recovery";
import type { AppBase } from "@/lib/app-routes";
import {
  areaLabel,
  bookingService,
  draftWhen,
  earliestBackBy,
  ERROR_TARGET,
  FIELD_ORDER,
  isHousehold,
  itemsOf,
  niceDate,
  NO_HINTS,
  OUTSIDE,
  pageWords,
  pickupLabel,
  toBookingData,
  validate,
  whatsappHref,
  type Common,
  type Coupon,
  type Errors,
  type FirstOrderLine,
  type FormState,
  type Photo,
  type Text,
} from "./booking-form-model";
import { MobileTotalBar, OrderSummary } from "./OrderSummary";
import { BookingSuccess, WhatsAppFallback } from "./BookingSuccess";

/**
 * Book a Pickup, quick first: what we're picking up (a line of text and/or service chips), your
 * details (with sector and address), then the pickup window, and Book. Everything else stays
 * folded until the customer wants it: items with prices (and the order summary with the ৳499
 * free-delivery nudge), a return date, instructions and photos.
 *
 * Pickup windows come from the Velto Scheduling Engine for the customer's sector: only windows
 * with room can be chosen, and Book reserves the window in the same transaction that creates the
 * Ops task (a window taken a moment earlier is refused, and the picker reloads). When capacity
 * booking is off, the same picker offers a preferred window that Velto confirms by phone.
 *
 * Language: the customer sees the page language (`t`), but everything sent to Velto Ops
 * (toBookingData) is English — the area label, the pickup preference, service slugs and item
 * lines. The estimate in the Ops notes is worked out again on the server from the price list.
 */

/** Service values from a service page (?service=): the three garment services, or a household one. */
const BOOKING_SERVICES = ["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];
const HOUSEHOLD_SERVICES = ["curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"];

/** "What are we picking up?" in the customer's own words. */
const WHAT_MAX = 160;

const SECTORS = Array.from({ length: 18 }, (_, i) => i + 1);

/* The unsent booking kept in this browser only (lib/booking-recovery.ts). Storage can be blocked. */
const noSubscribe = () => () => {};
const readStoredDraft = () => {
  try {
    return window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
};
const writeStoredDraft = (d: BookingDraft | null) => {
  try {
    if (d) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private mode or storage off: the draft is a convenience, never required.
  }
};

/** Service names as Velto reads them (for a call-back request). */
const OPS_SERVICE_NAMES: Record<string, string> = {
  "dry-cleaning": "Dry Cleaning",
  "wash-and-iron": "Wash & Iron",
  ironing: "Ironing",
  "curtain-cleaning": "Curtain Cleaning",
  "carpet-cleaning": "Carpet Cleaning",
  "blanket-comforter-cleaning": "Blanket & Comforter Cleaning",
};

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "failed"; code: Extract<SubmitResult, { ok: false }>["code"] }
  | { state: "success"; reference?: string };

/* ---------- presentational pieces (booking page only) ---------- */

const inputBase =
  "block w-full rounded-md border border-line-strong bg-white px-4 text-base text-navy placeholder:text-secondary/80 hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue aria-[invalid=true]:border-error";
const inputHeight = "h-[54px] md:h-[52px]";

function Group({
  step,
  id,
  title,
  hint,
  stepOf,
  locale,
  children,
}: {
  step: number;
  id?: string;
  title: string;
  hint?: string;
  /** "Step {n} of 4: " in the page language. */
  stepOf: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <fieldset id={id} className="min-w-0 scroll-mt-28 border-t border-line pt-5 first-of-type:border-t-0 first-of-type:pt-0">
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

/**
 * Service chips, the first thing under "What are we picking up?": the three garment services (any
 * mix) and one household service (curtains, carpets or bedding). A service page preselects its own.
 */
function ServiceChips({
  t,
  services,
  household,
  onServices,
  onHousehold,
  describedBy,
}: {
  t: Text;
  services: GarmentService[];
  household: string | null;
  onServices: (v: GarmentService[]) => void;
  onHousehold: (v: string | null) => void;
  describedBy?: string;
}) {
  // `relative` keeps each visually hidden checkbox inside its chip, so an error-summary link lands on it.
  const chip = (checked: boolean) =>
    `relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[15px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${
      checked ? "border-blue bg-[#f0f7fc] font-semibold text-navy" : "border-line-strong bg-white text-navy hover:border-navy/50"
    }`;
  return (
    <div role="group" aria-labelledby="booking-services-label" aria-describedby={describedBy} className="flex flex-wrap gap-2" data-service-chips>
      {GARMENT_SERVICES.map((slug) => {
        const checked = services.includes(slug);
        return (
          <label key={slug} className={chip(checked)}>
            <input
              id={`booking-service-${slug}`}
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() => onServices(checked ? services.filter((x) => x !== slug) : GARMENT_SERVICES.filter((x) => x === slug || services.includes(x)))}
            />
            {checked ? <span aria-hidden="true" className="mr-1.5 text-action">✓</span> : null}
            {t.services[slug]}
          </label>
        );
      })}
      {HOUSEHOLD_SERVICES.map((slug) => {
        const checked = household === slug;
        return (
          <label key={slug} className={chip(checked)}>
            <input id={`booking-service-${slug}`} type="checkbox" className="sr-only" checked={checked} onChange={() => onHousehold(checked ? null : slug)} />
            {checked ? <span aria-hidden="true" className="mr-1.5 text-action">✓</span> : null}
            {t.services[slug]}
          </label>
        );
      })}
    </div>
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
/** A folded part of the form: a quiet button that opens it in place. Open stays open. */
function Fold({ id, label, open, onOpen, children }: { id: string; label: string; open: boolean; onOpen: () => void; children: ReactNode }) {
  if (open) return <div id={id} data-fold-open>{children}</div>;
  return (
    <button
      type="button"
      aria-controls={id}
      aria-expanded={false}
      onClick={onOpen}
      className="inline-flex min-h-11 items-center gap-2 text-left font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue"
    >
      <span aria-hidden="true" className="text-action">+</span>
      {label}
    </button>
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
  offer,
  coupon,
  firstOrder,
  signInHref,
  savedAddresses = [],
  upsellHints = NO_HINTS,
  notify,
  appInstalled = false,
  base = "/account",
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
  /** The top bar's offer in one line (Promo & popup in the admin), repeated in the order summary. */
  offer?: string;
  /** The signed-in customer's monthly-goal reward for this month (the server adds it to the Ops notes). */
  coupon?: Coupon;
  /** The first-order 10%: "yours" for a signed-in first website order (with a goal coupon, whichever saves more), "guest" asks to sign in first. */
  firstOrder?: FirstOrderLine;
  /** Guests: the sign-in page that comes back to /book. */
  signInHref?: string;
  /** Signed-in customer's saved pickup addresses (Profile): one tap fills the area and address. */
  savedAddresses?: { label: string; address: string; area: string }[];
  /** Smart add-ons: this customer's regular items and what customers send together (server-read). */
  upsellHints?: UpsellHints;
  /** After booking: "Want updates on this pickup?" (signed in: turn on; guests: sign in first). */
  notify?: NotifyText;
  /** The customer already opened the Velto app on some phone: never offer it after booking. */
  appInstalled?: boolean;
  /** Where the success screen leads: the website (homepage, /account) or the installed app (/app/home). */
  base?: AppBase;
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
    what: "",
    sector: initialContact && (SECTORS.map(String).includes(initialContact.sector) || initialContact.sector === OUTSIDE) ? initialContact.sector : "",
    address: initialContact?.address ?? "",
    pickup: null,
    backBy: "",
    name: initialContact?.name ?? "",
    phone: initialContact?.phone ?? "",
    notes: presetNote ?? "",
    photos: [],
  });
  const [errors, setErrors] = useState<Errors>({});
  /** Bumped when a window was taken just before Confirm: the picker reloads live availability. */
  const [refreshWindows, setRefreshWindows] = useState(0);
  const setPickup = useCallback((v: PickedWindow | null) => setS((prev) => (prev.pickup === v ? prev : { ...prev, pickup: v })), []);
  // Items (with prices) and the extras stay folded until wanted; a repeat order opens its items.
  const [itemsOpen, setItemsOpen] = useState(initialItems.length > 0);
  const [extrasOpen, setExtrasOpen] = useState(Boolean(presetNote));
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const started = useRef(false);
  const phoneEntered = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // A booking started earlier on this device and not sent: offer to continue it (not over a repeat order).
  const storedDraft = useSyncExternalStore(noSubscribe, readStoredDraft, () => null);
  const night = useNightDhaka();
  const draft = useMemo(() => (initialItems.length ? null : readDraft(storedDraft)), [storedDraft, initialItems.length]);
  const [draftChoice, setDraftChoice] = useState<"pending" | "done">("pending");
  const draftOffer = draft && draftChoice === "pending" ? draft : null;
  // Keep the unsent booking in this browser as the visitor types (never photos or the pickup window).
  useEffect(() => {
    if (!started.current || status.state === "success") return;
    const id = window.setTimeout(() => writeStoredDraft(makeDraft(s)), 500);
    return () => window.clearTimeout(id);
  }, [s, status.state]);

  const continueDraft = (d: BookingDraft) => {
    started.current = true;
    track("booking_draft_restore", { section: "booking-form" });
    setDraftChoice("done");
    setS((prev) => ({
      ...prev,
      service: d.service && BOOKING_SERVICES.includes(d.service) ? d.service : prev.service,
      services: d.services.filter((x): x is GarmentService => isGarmentService(x)),
      what: d.what,
      items: d.items as ItemLine[],
      sector: SECTORS.map(String).includes(d.sector) || d.sector === OUTSIDE ? d.sector : prev.sector,
      address: d.address || prev.address,
      backBy: d.backBy,
      name: d.name || prev.name,
      phone: d.phone || prev.phone,
      notes: d.notes || prev.notes,
    }));
    if (d.items.length) setItemsOpen(true);
    if (d.backBy || d.notes) setExtrasOpen(true);
  };
  const startOver = () => {
    writeStoredDraft(null);
    setDraftChoice("done");
  };
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (status.state === "failed") statusRef.current?.focus();
    if (status.state === "success") {
      // Straight to the confirmation (not a smooth scroll from the footer), so its tick is seen.
      successRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      successRef.current?.focus({ preventScroll: true });
    }
  }, [status.state]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (draftChoice === "pending") setDraftChoice("done");
    if (!started.current) {
      started.current = true;
      track("booking_start", { section: "booking-form" });
    }
    if (key === "phone" && !phoneEntered.current && phoneOk(String(value))) {
      phoneEntered.current = true;
      track("phone_entered", { section: "booking-form" });
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
    if (FIELD_ORDER.some((k) => found[k])) {
      // Like the quote form: the error summary takes focus and links to each field.
      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ block: "start" });
        summaryRef.current?.focus({ preventScroll: true });
      });
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
      // `pickup`: "booked" when a live pickup window was reserved (Meta Schedule), else a preferred time.
      if (!previewOutcome) track("booking_success", { service: bookingService(s), pickup: s.pickup?.booked ? "booked" : "requested" });
      writeStoredDraft(null);
      setStatus({ state: "success", reference: result.reference });
    } else if (result.code === "slot_unavailable") {
      // Someone took the last place a moment ago: nothing was booked. Reload and ask again.
      setStatus({ state: "idle" });
      setS((prev) => ({ ...prev, pickup: null }));
      setErrors({ slot: t.slotTaken });
      setRefreshWindows((n) => n + 1);
      document.getElementById("booking-pickup")?.scrollIntoView({ block: "start" });
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
        notify={notify}
        signedIn={Boolean(initialContact)}
        appInstalled={appInstalled}
        base={base}
      />
    );
  }

  const submitting = status.state === "submitting";
  const errorList = FIELD_ORDER.filter((k) => errors[k]);
  const errorCount = errorList.length;
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
          {errorList.length ? (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="scroll-mt-28 rounded-md border border-error bg-error-soft p-4 focus:outline-2 focus:outline-error"
              data-error-summary
            >
              <p className="font-semibold text-error">
                {errorList.length === 1 ? t.errorSummaryOne : fill(t.errorSummaryMany, { n: errorList.length }, locale)}
              </p>
              <ul className="mt-2 space-y-1 t-small">
                {errorList.map((k) => (
                  <li key={k}>
                    <a href={`#${ERROR_TARGET[k]}`} className="text-error underline underline-offset-2">
                      {t.errorLabels[k]}: {errors[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <RequiredNote>{c.requiredNote}</RequiredNote>
          {draftOffer ? (
            <div role="region" aria-labelledby="draft-title" className="rounded-md border border-blue/30 bg-[#f0f7fc] p-4" data-draft>
              <p id="draft-title" className="font-semibold text-navy">
                {t.draftTitle}
              </p>
              <p className="mt-1 t-small text-body">{format(t.draftBody, { when: draftWhen(draftOffer.savedAt, t, locale) })}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" onClick={() => continueDraft(draftOffer)} className="inline-flex h-11 items-center justify-center rounded-md bg-navy px-5 font-semibold text-white hover:bg-navy/90">
                  {t.draftContinue}
                </button>
                <button type="button" onClick={startOver} className="inline-flex h-11 items-center justify-center rounded-md border border-line-strong bg-white px-5 font-semibold text-navy hover:border-navy">
                  {t.draftStartOver}
                </button>
              </div>
            </div>
          ) : null}
          <Group step={1} title={t.whatTitle} stepOf={t.stepOf} locale={locale}>
            {/* Services first; the customer's own words follow as an "anything else?" line. */}
            <div>
              <p id="booking-services-label" className="text-[15px] font-semibold text-navy">
                {t.servicesTitle}
              </p>
              <div className="mt-2">
                <ServiceChips
                  t={t}
                  services={s.services}
                  household={isHousehold(s) ? s.service : null}
                  onServices={(v) => update("services", v)}
                  onHousehold={(v) => update("service", v)}
                  describedBy={errors.what ? "booking-what-error" : undefined}
                />
              </div>
            </div>
            <TextField
              id="booking-what"
              name="what"
              label={t.whatLabel}
              optional={Boolean(isHousehold(s) || s.services.length || s.items.length)}
              optionalText={c.optional}
              helper={t.whatHelp}
              error={errors.what}
              type="text"
              enterKeyHint="next"
              maxLength={WHAT_MAX}
              placeholder={t.whatPlaceholder}
              value={s.what}
              onChange={(e) => update("what", e.target.value)}
            />
            <Fold
              id="booking-items-fold"
              label={t.itemsOpen}
              open={itemsOpen}
              onOpen={() => {
                setItemsOpen(true);
                track("booking_items_open", { section: "booking-form" });
              }}
            >
              <p className="font-semibold text-navy">{t.itemsTitle}</p>
              <p className="mt-1 t-small text-secondary">{t.itemsHint}</p>
              <div className="mt-3">
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
              </div>
            </Fold>
          </Group>

          <Group step={2} title={t.youTitle} stepOf={t.stepOf} locale={locale}>
            <TextField
              id="booking-name"
              name="name"
              label={t.nameLabel}
              required
              error={errors.name}
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              value={s.name}
              onChange={(e) => update("name", e.target.value)}
            />

            <TextField
              id="booking-phone"
              name="phone"
              label={t.phoneLabel}
              required
              helper={s.pickup?.booked ? t.phoneHelpBooked : t.phoneHelp}
              error={errors.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              placeholder="01XXX XXXXXX"
              value={s.phone}
              onChange={(e) => update("phone", e.target.value)}
              onBlur={checkPhoneOnBlur}
            />

            {savedAddresses.length ? (
              <div data-saved-addresses>
                <p className="text-[15px] font-semibold text-navy">{t.savedAddresses}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {savedAddresses.map((a, i) => {
                    const chosen = s.address === a.address && (!a.area || s.sector === a.area);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => {
                          update("address", a.address);
                          if (a.area) update("sector", a.area);
                        }}
                        className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 text-left t-small font-semibold ${
                          chosen ? "border-action bg-[#e8f3fb] text-navy" : "border-line-strong bg-white text-navy hover:border-navy"
                        }`}
                      >
                        <span>{a.label || fill(t.savedAddressFallback, { n: i + 1 }, locale)}</span>
                        <span className="truncate font-normal text-secondary">{a.address}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <SelectField
              id="booking-sector"
              name="sector"
              label={t.sectorLabel}
              required
              error={errors.sector}
              // As on the quote form, the outside-area note shows as the field's helper.
              helper={s.sector === OUTSIDE ? <span className="text-navy">{t.outsideNote}</span> : undefined}
              value={s.sector}
              onChange={(e) => update("sector", e.target.value)}
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
            </SelectField>

            <TextField
              id="booking-address"
              name="address"
              label={t.addressLabel}
              required
              error={errors.address}
              type="text"
              autoComplete="address-line1"
              enterKeyHint="next"
              placeholder={t.addressPlaceholder}
              value={s.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </Group>

          <Group step={3} id="booking-pickup" title={t.pickupTitle} stepOf={t.stepOf} locale={locale}>
            <PickupWindows
              sector={s.sector === OUTSIDE ? "" : s.sector}
              outside={s.sector === OUTSIDE}
              value={s.pickup}
              onChange={setPickup}
              refresh={refreshWindows}
              t={t}
              c={c}
              locale={locale}
              errorDate={errors.date}
              errorSlot={errors.slot}
            />

            <Fold id="booking-extras-fold" label={t.extrasOpen} open={extrasOpen} onOpen={() => setExtrasOpen(true)}>
              <div className="space-y-4">
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
                      MAX_BOOKING_NOTES -
                    NOTE_EXTRAS_RESERVE -
                    s.photos.length * NOTE_PHOTO_RESERVE -
                    (composeBookingNotes(itemsOf(s), "x")?.length ?? 0) -
                    (s.what.trim() ? s.what.trim().length + 16 : 0),
                    )}
                    placeholder={t.notesPlaceholder}
                    value={s.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    className={`${inputBase} mt-2 min-h-[120px] py-3 leading-[1.4]`}
                  />
                </div>

                <PhotoPicker t={t} c={c} locale={locale} photos={s.photos} onAdd={addPhotos} onRemove={removePhoto} error={errors.photos} />
              </div>
            </Fold>
          </Group>

          {s.items.length || coupon || offer || firstOrder ? (
            <OrderSummary
              s={s}
              t={t}
              locale={locale}
              chargeMinor={pickupChargeMinor}
              offer={offer}
              coupon={coupon}
              firstOrder={firstOrder}
              signInHref={signInHref}
              popular={popularItems}
              hints={upsellHints}
              onAdd={(item, service, reason) => {
                const at = s.items.findIndex((l) => l.item === item.name && l.service === service);
                update(
                  "items",
                  at >= 0 ? s.items.map((l, i) => (i === at ? { ...l, quantity: l.quantity + 1 } : l)) : [...s.items, repeatLine(item.name, service, 1, item)],
                );
                track("booking_addon_add", { section: "booking-summary", service, placement: `addon_${reason}` });
              }}
            />
          ) : (
            <p className="t-small text-navy" data-free-note>
              {format(t.summaryFreeNote, { amount: localDigits(FREE_DELIVERY_THRESHOLD, locale) })}
            </p>
          )}
          <MobileTotalBar s={s} t={t} locale={locale} chargeMinor={pickupChargeMinor} coupon={coupon} />

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

            {/* A reminder by the button; the error summary at the top is what gets announced. */}
            {errorCount > 0 ? (
              <p className="mb-4 t-small font-medium text-error">
                {errorCount === 1 ? t.errorsOne : fill(t.errorsMany, { n: errorCount }, locale)}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className="inline-flex h-[54px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-md bg-action px-7 text-base font-semibold text-white hover:bg-action-hover active:bg-action-active disabled:cursor-wait disabled:opacity-85 md:h-12 md:w-auto"
              data-press
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

            <p className="mt-4 t-small text-secondary">{s.pickup?.booked ? t.reassureBooked : night ? t.reassureTimeNight : t.reassureTime}</p>
            <CallbackRequest
              t={t}
              initialName={s.name}
              initialPhone={s.phone}
              nameError={t.errors.name}
              phoneError={c.phoneInvalid}
              whatsappHref={whatsappHref(s, t, c, locale, pickupChargeMinor)}
              context={() => ({
                area: s.sector ? areaLabel(s.sector) : undefined,
                what: [s.what.trim(), s.items.length ? itemsOf(s).map((i) => `${i.quantity} × ${i.item}`).join(", ") : ""].filter(Boolean).join(" · ") || undefined,
                services: (isHousehold(s) && s.service ? [s.service] : s.services).map((x) => OPS_SERVICE_NAMES[x] ?? x).join(", ") || undefined,
                preferred: pickupLabel(s) || undefined,
              })}
            />
          </div>
        </form>
      </div>
    </>
  );
}
