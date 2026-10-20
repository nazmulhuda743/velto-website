"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/app/BottomSheet";
import { ChipGroup, Segmented, Stepper } from "@/components/app/controls";
import { Banner, buttonClass, whatsappHref, WhatsAppIcon } from "@/components/app/ui";
import { hoursText } from "@/components/forms/PickupWindows";
import { usePickupDays } from "@/components/app/usePickupDays";
import { submitBooking, type BookingFormData } from "@/components/forms/submit";
import { track } from "@/components/layout/Analytics";
import { openToNowBucket } from "@/lib/analytics/app-open";
import type { FormText } from "@/content/i18n/forms/en";
import { GARMENT_SERVICES, sharedItemService, type GarmentService } from "@/lib/booking-items";
import type { WindowId } from "@/lib/capacity-logic";
import { addressWithArea, defaultSlot, isTomorrow, pickupDays, sectorNumber } from "@/lib/customer/app-logic";
import { joinNotes } from "@/lib/customer/extras";
import { areaLabel } from "@/lib/customer/validation";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import { opsPickupWhen } from "@/lib/pickup-when";
import { PricesPanel } from "@/components/app/prices/PricesPanel";
import { NotifyPrompt } from "./NotifyPrompt";

export type BookItem = { item: string; service: GarmentService; quantity: number };
export type BookAddress = { label: string | null; address: string; area: string };
/** An item on the price list with its price (minor units) per garment service it offers. */
export type PriceRow = { name: string; prices: Partial<Record<GarmentService, number>> };

type Text = FormText["common"]["app"] & {
  serviceNames: Record<GarmentService, string>;
  slotNames: Record<string, string>;
  sectorLabel: string;
  sectorPlaceholder: string;
  sectorOption: string;
  outsideOption: string;
  addressLabel: string;
  addressPlaceholder: string;
  errService: string;
  errSector: string;
  errAddress: string;
  errSlot: string;
  slotTaken: string;
  duplicate: string;
  sending: string;
  whatsapp: FormText["booking"]["whatsapp"];
  weekdays: readonly string[];
  months: readonly string[];
  dayMonth: string;
};

type Sheet = null | "service" | "items" | "prices" | "address" | "note";
type Errors = Partial<Record<"service" | "address" | "slot", string>>;

const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
const MAX_QTY = 99;

/**
 * The app's booking (design "Book"): a summary of what will be picked up, each row opening a sheet
 * (service, items, pickup address, note), then the day and window from live capacity, and one
 * button that is never disabled: problems are shown in place when it is tapped. It books through
 * /api/bookings exactly like the website's form (same validation, Ops task, manager alert).
 */
export function AppBookingFlow({
  locale,
  name,
  phone,
  phoneText,
  services: initialServices,
  items: initialItems,
  sameAsLast,
  addresses,
  prices,
  popular,
  baseNote,
  offer,
  notifyAfter,
  homeHref,
  source,
  t,
}: {
  locale: Locale;
  name: string;
  phone: string;
  phoneText: string;
  services: GarmentService[];
  items: BookItem[];
  sameAsLast: boolean;
  addresses: BookAddress[];
  prices: PriceRow[];
  popular: string[];
  baseNote: string;
  offer: string | null;
  notifyAfter: boolean;
  homeHref: string;
  /** Where this booking started (lib/customer/app-sources). */
  source: string;
  t: Text;
}) {
  const [services, setServices] = useState<GarmentService[]>(initialServices);
  const [items, setItems] = useState<BookItem[]>(initialItems);
  const [addressIndex, setAddressIndex] = useState<number>(addresses.length ? 0 : -1);
  const [other, setOther] = useState<{ address: string; area: string }>({ address: "", area: "" });
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState<GarmentService>(initialServices[0] ?? "wash-and-iron");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PriceRow[]>([]);
  const [reload, setReload] = useState(0);
  const [picked, setPicked] = useState<{ date: string; window: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<{ kind: "idle" | "sending" | "failed" } | { kind: "done"; reference?: string; when: string }>({ kind: "idle" });
  const timeRef = useRef<HTMLDivElement>(null);

  const where = addressIndex >= 0 ? addresses[addressIndex] : { label: null, ...other };
  const sector = sectorNumber(where?.area);

  // Pickup days for the address's sector (live capacity, or the usual windows when it's off).
  const load = usePickupDays(sector, reload);

  // Item search beyond the popular list: the same public price search as the Prices screen.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/prices?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { items?: { name: string; services: { slug: string; amountMinor: number | null }[] }[] } | null) => {
          setFound(
            (body?.items ?? []).map((p) => ({
              name: p.name,
              prices: Object.fromEntries(p.services.filter((s) => (GARMENT_SERVICES as readonly string[]).includes(s.slug) && s.amountMinor !== null).map((s) => [s.slug, s.amountMinor as number])),
            })),
          );
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const days = useMemo(() => (load.state === "ready" ? pickupDays(load.days, load.today) : []), [load]);
  const today = load.state === "ready" ? load.today : dhakaToday();
  const fallback = load.state === "ready" ? defaultSlot(load.days, load.today, null) : null;
  const slot = picked && days.some((d) => d.date === picked.date && d.windows.some((w) => w.id === picked.window)) ? picked : fallback;
  const day = slot ? days.find((d) => d.date === slot.date) : undefined;
  const win = slot && day ? day.windows.find((w) => w.id === slot.window) : undefined;

  // ---- Words ----
  const money = (minor: number) => `৳${localDigits(Math.round(minor / 100), locale)}`;
  const priceOf = (item: string, service: GarmentService) => [...prices, ...found].find((p) => p.name === item)?.prices[service] ?? null;
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const estimate = items.reduce((sum, i) => sum + (priceOf(i.item, i.service) ?? 0) * i.quantity, 0);
  const itemsWord = (n: number) => fill(n === 1 ? t.itemsOne : t.itemsMany, { n }, locale);
  const shown = [...new Set([...services, ...items.map((i) => i.service)])];
  const serviceText = shown.map((s) => t.serviceNames[s]).join(" + ");
  const itemsText = items.map((i) => fill(t.itemLine, { n: i.quantity, item: i.item, service: t.serviceNames[i.service] }, locale)).join(", ");
  const dateText = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    return fill(t.dayMonth, { weekday: t.weekdays[d.getUTCDay()], day: d.getUTCDate(), month: t.months[d.getUTCMonth()] }, locale);
  };
  const windowText = (w: { id: string; starts: string; ends: string }) => t.windows[w.id] ?? hoursText(w.starts, w.ends, locale);
  const slotText = (withTomorrow: boolean) => (slot && win ? `${withTomorrow && isTomorrow(slot.date, today) ? `${t.tomorrow}, ` : ""}${dateText(slot.date)}, ${windowText(win)}` : "");
  const areaText = (area: string) => (area === "outside" ? t.outsideOption : fill(t.sectorOption, { n: area }, locale));
  const addressText = where && where.address ? addressWithArea(where.address, where.area, where.area ? areaText(where.area) : null) : "";

  const qty = (item: string, service: GarmentService) => items.find((i) => i.item === item && i.service === service)?.quantity ?? 0;
  const setQty = (item: string, service: GarmentService, n: number) =>
    setItems((list) => {
      const rest = list.filter((i) => !(i.item === item && i.service === service));
      return n > 0 ? [...rest, { item, service, quantity: Math.min(MAX_QTY, n) }] : rest;
    });

  // ---- Booking ----
  function check(): Errors {
    const e: Errors = {};
    if (!services.length && !items.length) e.service = t.errService;
    if (!where || !where.area) e.address = t.errSector;
    else if (where.address.trim().length < 5) e.address = t.errAddress;
    if (!slot || !win) e.slot = t.errSlot;
    return e;
  }

  const payload = (): BookingFormData | null => {
    if (!where || !slot || !win || load.state !== "ready") return null;
    const lines = items.map((i) => ({ item: i.item, service: i.service, quantity: i.quantity }));
    return {
      name,
      phone,
      area: areaLabel(where.area) ?? "",
      address: where.address.trim(),
      preferredPickup: opsPickupWhen(slot.date, { id: win.id as WindowId, starts: win.starts, ends: win.ends }, load.live),
      service: (lines.length ? sharedItemService(lines) : undefined) ?? (services.length === 1 ? services[0] : undefined),
      ...(services.length ? { services } : {}),
      ...(lines.length ? { items: lines } : {}),
      notes: joinNotes(baseNote, note.trim()) || undefined,
      ...(load.live ? { slot: { date: slot.date, window: win.id } } : {}),
    };
  };

  async function book() {
    if (state.kind === "sending") return;
    const e = check();
    setErrors(e);
    if (Object.keys(e).length) {
      if (e.slot && !e.service && !e.address) timeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const data = payload();
    if (!data) return;
    setState({ kind: "sending" });
    track("booking_start", { section: "app-book", placement: source });
    const result = await submitBooking(data, { source });
    if (result.ok) {
      track("booking_success", { section: "app-book", placement: source, service: data.service, detail: openToNowBucket() });
      setState({ kind: "done", reference: result.reference, when: slotText(false) });
      window.scrollTo({ top: 0 });
    } else if (result.code === "slot_unavailable") {
      setPicked(null);
      setReload((n) => n + 1);
      setErrors({ slot: t.slotTaken });
      setState({ kind: "idle" });
    } else if (result.code === "duplicate_submission") {
      setErrors({ slot: t.duplicate });
      setState({ kind: "idle" });
    } else {
      setState({ kind: "failed" });
    }
  }

  /** The WhatsApp fallback carries what the customer chose, in their language. */
  const whatsappText = () =>
    [
      t.whatsapp.greeting,
      itemsText ? format(t.whatsapp.items, { v: itemsText }) : serviceText ? format(t.whatsapp.service, { v: serviceText }) : "",
      addressText ? format(t.whatsapp.address, { v: addressText }) : "",
      slot && win ? format(t.whatsapp.pickup, { v: slotText(true) }) : "",
      format(t.whatsapp.name, { v: name }),
      note.trim() ? format(t.whatsapp.note, { v: note.trim() }) : "",
    ]
      .filter(Boolean)
      .join("\n");

  // ---- Success ----
  if (state.kind === "done") {
    return (
      <div data-app-book-success>
        <div className="space-y-3.5 pt-6">
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-app-green-tint">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="#1e7a46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <h1 role="status" className="a-title a-entry">
            {t.successTitle}
          </h1>
          <p className="a-row text-body">{format(t.successBody, { when: state.when, phone: phoneText })}</p>
          {state.reference ? <p className="a-sec text-muted">{format(t.successRef, { ref: state.reference })}</p> : null}
        </div>
        {notifyAfter ? (
          <div className="mt-7">
            <NotifyPrompt lang={locale === "bn" ? "bn" : "en"} t={{ title: t.notifTitle, body: t.notifBody, on: t.turnOn, later: t.notNow }} />
          </div>
        ) : null}
        <Link href={homeHref} className={buttonClass("secondary", "mt-7")}>
          {t.backHome}
        </Link>
      </div>
    );
  }

  const failed = state.kind === "failed";
  const row = "flex w-full min-h-13 items-center justify-between gap-3 border-b border-line p-4 text-left last:border-b-0";
  const chevron = (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0 text-app-off-text" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
  const err = (m?: string) =>
    m ? (
      <span role="alert" className="mt-1 block a-cap font-semibold text-app-red">
        {m}
      </span>
    ) : null;

  return (
    <div data-app-book>
      <header className="space-y-1.5">
        <h1 className="a-title">{t.bookTitle}</h1>
        {sameAsLast && !failed ? <p className="a-body text-muted">{t.bookSub}</p> : null}
      </header>

      {failed ? (
        <Banner tone="error" title={t.sendFailTitle} className="mt-4">
          {t.sendFailBody}
        </Banner>
      ) : null}
      {offer && !failed ? (
        <Banner className="mt-4" tone="info">
          {offer}
        </Banner>
      ) : null}

      <section className={`mt-5 overflow-hidden rounded-2xl border border-line bg-app-card ${failed ? "opacity-70" : ""}`} aria-label={t.bookTitle}>
        <button type="button" className={row} onClick={() => setSheet("service")} data-row="service">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="a-meta text-muted">{t.service}</span>
            <span className={`a-row font-semibold ${serviceText ? "text-navy" : "text-muted"}`}>{serviceText || t.chooseService}</span>
            {err(errors.service)}
          </span>
          {chevron}
        </button>
        <button type="button" className={row} onClick={() => setSheet("items")} data-row="items">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="a-meta text-muted">{t.itemsLabel}</span>
            <span className="a-row text-body">{itemsText || t.countedAtPickup}</span>
            {items.length ? (
              estimate > 0 ? <span className="a-cap text-muted">{fill(t.estimateLine, { amt: money(estimate) }, locale)}</span> : null
            ) : (
              <span className="a-cap font-semibold text-action">{t.addForEstimate}</span>
            )}
          </span>
          {chevron}
        </button>
        <button type="button" className={row} onClick={() => setSheet("address")} data-row="address">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="a-meta text-muted">
              {t.pickupFrom}
              {where?.label ? ` · ${where.label}` : ""}
            </span>
            <span className={`a-row ${addressText ? "text-body" : "text-muted"}`}>{addressText || t.addressPlaceholder}</span>
            <span className="a-cap text-muted">{phoneText}</span>
            {err(errors.address)}
          </span>
          {chevron}
        </button>
        <button type="button" className={row} onClick={() => timeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })} data-row="time">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="a-meta text-muted">{t.pickupTime}</span>
            {load.state === "loading" ? <span className="skeleton mt-1 block h-5 w-56 max-w-full" aria-hidden="true" /> : <span className="a-row text-body">{slotText(true) || t.noWindowsShort}</span>}
          </span>
          {chevron}
        </button>
        <button type="button" className={row} onClick={() => setSheet("note")} data-row="note">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="a-meta text-muted">{t.noteForRider}</span>
            <span className={`a-row ${note.trim() ? "text-body" : "text-muted"}`}>{note.trim() || t.noteOptional}</span>
          </span>
          {chevron}
        </button>
      </section>

      {items.length && estimate > 0 && !failed ? (
        <Banner className="mt-4" title={fill(t.estimateTitle, { amt: money(estimate) }, locale)}>
          <span className="text-body">{t.estimateBody}</span>
        </Banner>
      ) : null}

      {failed ? null : (
        <div ref={timeRef} className="mt-5 space-y-4 scroll-mt-24" data-app-times>
          {days.length ? (
            <>
              <ChipGroup
                legend={t.pickupDay}
                name="app-day"
                variant="day"
                value={slot?.date ?? null}
                onChange={(date) => {
                  const d = days.find((x) => x.date === date);
                  const keep = d?.windows.find((w) => w.id === slot?.window) ?? d?.windows[0];
                  if (keep) setPicked({ date, window: keep.id });
                  setErrors((e) => ({ ...e, slot: undefined }));
                }}
                options={days.map((d) => {
                  const x = new Date(`${d.date}T00:00:00Z`);
                  return { value: d.date, label: isTomorrow(d.date, today) ? t.tomorrow : t.weekdays[x.getUTCDay()], sub: `${localDigits(x.getUTCDate(), locale)} ${t.months[x.getUTCMonth()]}` };
                })}
              />
              {day ? (
                <ChipGroup
                  legend={t.timeWindow}
                  name="app-window"
                  variant="day"
                  value={slot?.window ?? null}
                  onChange={(w) => {
                    setPicked({ date: day.date, window: w });
                    setErrors((e) => ({ ...e, slot: undefined }));
                  }}
                  options={day.windows.map((w) => ({ value: w.id, label: t.slotNames[w.id] ?? w.id, sub: hoursText(w.starts, w.ends, locale) }))}
                />
              ) : null}
            </>
          ) : load.state === "loading" ? (
            <span className="skeleton block h-24 w-full" />
          ) : (
            <p className="a-sec text-body">{t.noWindowsShort}</p>
          )}
          {err(errors.slot)}
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {failed ? (
          <>
            <button type="button" onClick={() => (setState({ kind: "idle" }), void book())} className={buttonClass("primary")}>
              {t.retry}
            </button>
            <a href={whatsappHref(whatsappText())} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")} data-analytics="whatsapp_click" data-placement="app_book_failed">
              <WhatsAppIcon className="size-5 text-whatsapp" />
              {t.bookOnWhatsapp}
            </a>
            <p className="text-center a-cap text-muted">{t.whatsappPrefill}</p>
          </>
        ) : (
          <>
            <button type="button" onClick={book} className={buttonClass("primary")} aria-busy={state.kind === "sending"} data-analytics="book_pickup_click" data-placement="app_book">
              {state.kind === "sending" ? (
                <>
                  <span aria-hidden="true" className="size-[18px] animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" />
                  {t.sending}
                </>
              ) : (
                t.bookPickup
              )}
            </button>
            <p className="text-center a-cap text-muted">{t.nothingToPay}</p>
          </>
        )}
      </div>

      {/* ---- Sheets ---- */}
      <BottomSheet open={sheet === "service"} onClose={() => setSheet(null)} title={t.service} closeLabel={t.close}>
        <fieldset className="pt-1">
          <legend className="sr-only">{t.service}</legend>
          <div className="flex flex-col gap-2">
            {GARMENT_SERVICES.map((s) => {
              const on = services.includes(s);
              return (
                <label key={s} className={`flex min-h-13 cursor-pointer items-center justify-between rounded-xl border-[1.5px] px-4 a-row ${on ? "border-action bg-app-tint font-semibold text-navy" : "border-app-chip bg-app-card text-body"}`}>
                  {t.serviceNames[s]}
                  <input
                    type="checkbox"
                    className="size-5 accent-[#0b72b9]"
                    checked={on}
                    onChange={() => {
                      setServices((list) => (on ? list.filter((x) => x !== s) : [...list, s]));
                      setErrors((e) => ({ ...e, service: undefined }));
                    }}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      </BottomSheet>

      <BottomSheet
        open={sheet === "items"}
        // Only when this sheet itself closes: switching to the price list closes it too, and must not
        // close the price list (the dialog's close event fires after the switch).
        onClose={() => setSheet((x) => (x === "items" ? null : x))}
        title={t.addItems}
        sub={t.pickerSub}
        closeLabel={t.close}
        footer={
          <div className="space-y-2.5">
            <button type="button" className={buttonClass("primary")} onClick={() => setSheet(null)}>
              {count ? fill(t.pickerDone, { items: itemsWord(count), amt: money(estimate) }, locale) : t.pickerDoneEmpty}
            </button>
            <button
              type="button"
              className={buttonClass("text", "w-full")}
              onClick={() => {
                setItems([]);
                setSheet(null);
              }}
            >
              {t.notSure}
            </button>
          </div>
        }
      >
        <div className="space-y-3 pt-1">
          <Segmented legend={<span className="sr-only">{t.service}</span>} name="item-tab" value={tab} onChange={(v) => setTab(v as GarmentService)} options={GARMENT_SERVICES.map((s) => ({ value: s, label: t.serviceNames[s] }))} />
          <label className="flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-line-strong bg-app-card px-3.5">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
            </svg>
            <span className="sr-only">{t.searchPlaceholder}</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent a-body outline-none" />
          </label>
          {query.trim().length < 2 ? <p className="a-eyebrow pt-2 text-muted">{t.popular}</p> : null}
          <ul className="overflow-hidden rounded-2xl border border-line bg-app-card">
            {(query.trim().length >= 2
              ? [...prices.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())), ...found].filter((p, i, all) => all.findIndex((x) => x.name === p.name) === i)
              : popular.map((n) => prices.find((p) => p.name === n)).filter((p): p is PriceRow => Boolean(p))
            )
              .filter((p) => p.prices[tab] !== undefined)
              .slice(0, 20)
              .map((p) => {
                const n = qty(p.name, tab);
                return (
                  <li key={p.name} className="flex min-h-13 items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="a-body font-semibold text-navy">{p.name}</span>
                      <span className="a-cap text-muted">{money(p.prices[tab] ?? 0)}</span>
                    </span>
                    {n ? (
                      <Stepper value={n} onChange={(v) => setQty(p.name, tab, v)} max={MAX_QTY} label={p.name} decreaseLabel={fill(t.decrease, { item: p.name }, locale)} increaseLabel={fill(t.increase, { item: p.name }, locale)} />
                    ) : (
                      <button
                        type="button"
                        aria-label={fill(t.increase, { item: p.name }, locale)}
                        onClick={() => {
                          setQty(p.name, tab, 1);
                          setErrors((e) => ({ ...e, service: undefined }));
                        }}
                        className="flex size-11 items-center justify-center rounded-[10px] border-[1.5px] border-line-strong text-[20px] font-semibold text-action"
                      >
                        +
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
          {/* The full price list opens over the picker; the picked items stay. */}
          <button type="button" onClick={() => setSheet("prices")} className="inline-flex min-h-11 items-center a-sec font-semibold text-action" data-app-all-prices>
            {t.allItems}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "prices"}
        onClose={() => setSheet((x) => (x === "prices" ? "items" : x))}
        title={t.allItems}
        closeLabel={t.close}
        footer={
          <button type="button" className={buttonClass("primary")} onClick={() => setSheet("items")}>
            {t.addItems}
          </button>
        }
      >
        <PricesPanel
          popular={popular.map((n) => prices.find((p) => p.name === n)).filter((p): p is PriceRow => Boolean(p))}
          t={{ pricesSub: t.pricesSub, pricesFoot: t.pricesFoot, searchPlaceholder: t.searchPlaceholder, serviceNames: t.serviceNames }}
          locale={locale}
        />
      </BottomSheet>

      <BottomSheet open={sheet === "address"} onClose={() => setSheet(null)} title={t.pickupFrom} closeLabel={t.close}>
        <fieldset className="space-y-2 pt-1">
          <legend className="sr-only">{t.pickupFrom}</legend>
          {addresses.map((a, i) => (
            <label key={`${a.address}-${i}`} className={`flex min-h-13 cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 ${addressIndex === i ? "border-action bg-app-tint" : "border-app-chip bg-app-card"}`}>
              <input type="radio" name="app-address" className="mt-1 size-4 accent-[#0b72b9]" checked={addressIndex === i} onChange={() => (setAddressIndex(i), setErrors((e) => ({ ...e, address: undefined })))} />
              <span className="flex flex-col">
                {a.label ? <span className="a-meta font-semibold text-navy">{a.label}</span> : null}
                <span className="a-body text-body">{addressWithArea(a.address, a.area, areaText(a.area))}</span>
              </span>
            </label>
          ))}
          <label className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] p-3.5 ${addressIndex === -1 ? "border-action bg-app-tint" : "border-app-chip bg-app-card"}`}>
            <input type="radio" name="app-address" className="size-4 accent-[#0b72b9]" checked={addressIndex === -1} onChange={() => setAddressIndex(-1)} />
            <span className="a-body font-semibold text-navy">{t.otherAddress}</span>
          </label>
          {addressIndex === -1 ? (
            <div className="space-y-3 pt-2">
              <label className="block">
                <span className="a-sec font-semibold text-navy">{t.sectorLabel}</span>
                <select value={other.area} onChange={(e) => (setOther((o) => ({ ...o, area: e.target.value })), setErrors((x) => ({ ...x, address: undefined })))} className="mt-1.5 h-13 w-full rounded-xl border-[1.5px] border-line-strong bg-app-card px-4 a-row">
                  <option value="">{t.sectorPlaceholder}</option>
                  {Array.from({ length: 18 }, (_, i) => String(i + 1)).map((n) => (
                    <option key={n} value={n}>
                      {fill(t.sectorOption, { n }, locale)}
                    </option>
                  ))}
                  <option value="outside">{t.outsideOption}</option>
                </select>
              </label>
              <label className="block">
                <span className="a-sec font-semibold text-navy">{t.addressLabel}</span>
                <input value={other.address} onChange={(e) => (setOther((o) => ({ ...o, address: e.target.value })), setErrors((x) => ({ ...x, address: undefined })))} placeholder={t.addressPlaceholder} maxLength={200} className="mt-1.5 h-13 w-full rounded-xl border-[1.5px] border-line-strong bg-app-card px-4 a-row" />
              </label>
            </div>
          ) : null}
        </fieldset>
      </BottomSheet>

      <BottomSheet open={sheet === "note"} onClose={() => setSheet(null)} title={t.noteForRider} closeLabel={t.close}>
        <label className="block pt-1">
          <span className="sr-only">{t.noteForRider}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={4} className="w-full rounded-xl border-[1.5px] border-line-strong bg-app-card p-4 a-row" />
        </label>
      </BottomSheet>
    </div>
  );
}
