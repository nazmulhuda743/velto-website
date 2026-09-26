"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/ui/icons";
import type { FormText } from "@/content/i18n/forms/en";
import { format, localDigits, type Locale } from "@/lib/i18n/config";
import { formatAmount } from "@/lib/format-price";
import {
  cleanItemName,
  GARMENT_SERVICES,
  ITEM_SERVICES,
  isItemService,
  MAX_BOOKING_ITEMS,
  MAX_ITEM_NAME,
  MAX_ITEM_QUANTITY,
  MIXED_ITEM,
  type ItemService,
} from "@/lib/booking-items";

/** A price-list entry as /api/prices and the book page send it (amounts from Velto Ops). */
export type PriceItem = {
  slug: string;
  name: string;
  services: { slug: string; amountMinor: number | null; unitLabel: string | null }[];
};

/**
 * One line in the booking: item + service + quantity. `prices` holds the item's unit price per
 * service from the price list (null: priced at pickup), so changing the service keeps a price.
 */
export type ItemLine = {
  id: string;
  item: string;
  service: ItemService | "";
  quantity: number;
  options: ItemService[];
  prices: Partial<Record<ItemService, number | null>>;
};

/** Unit price for the estimate: per-unit prices (per sq ft) need a measurement, so they count as unpriced. */
const unitPrice = (s: PriceItem["services"][number]) => (s.amountMinor !== null && !s.unitLabel ? s.amountMinor : null);

export const lineUnit = (l: ItemLine) => (l.service ? (l.prices[l.service] ?? null) : null);

export const money = (minor: number, locale: Locale) => localDigits(formatAmount(minor), locale);

let lineCounter = 0;
function newLine(item: string, options: ItemService[], service: ItemService | "", prices: ItemLine["prices"] = {}): ItemLine {
  lineCounter += 1;
  return { id: `line-${lineCounter}`, item, service, quantity: 1, options, prices };
}

const control =
  "rounded-md border border-line-strong bg-white text-base text-navy hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue";

/**
 * Step 2 of Book a Pickup: popular items and a search of Velto's price list, each showing its
 * price for the chosen services. Tapping a price adds the item on that service (or one more of
 * it). Anything not listed can be added as typed, and "A mix, or not sure" adds a catch-all line;
 * those are priced at pickup. Item names stay as the price list has them (they match Ops).
 */
export function BookingItems({
  t,
  services,
  mixedLabel,
  lines,
  onChange,
  chosen,
  popular,
  locale,
}: {
  t: FormText["booking"]["items"];
  /** Service names by slug, in the page language. */
  services: Record<string, string>;
  /** "Mixed items" in the page language (the line itself stays MIXED_ITEM for Ops). */
  mixedLabel: string;
  lines: ItemLine[];
  onChange: (lines: ItemLine[]) => void;
  /** Services chosen in step 1: only their prices are offered. None chosen: all three. */
  chosen: ItemService[];
  /** Popular items with their prices, read on the server; empty when prices are unavailable. */
  popular: PriceItem[];
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  // Results remember the query they answer, so a slower earlier search never shows for a newer one.
  const [results, setResults] = useState<{ q: string; items: PriceItem[] }>({ q: "", items: [] });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const id = useId();
  const offered: ItemService[] = chosen.length ? chosen : [...GARMENT_SERVICES];
  const itemName = (item: string) => (item === MIXED_ITEM ? mixedLabel : item);
  const full = lines.length >= MAX_BOOKING_ITEMS;
  const typed = cleanItemName(query);
  const q = query.trim();
  const searching = q.length >= 2;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/prices?${new URLSearchParams({ q })}`, { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as { items?: PriceItem[] };
        setResults({ q, items: data.items ?? [] });
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults({ q, items: [] });
        setStatus("error");
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, searching]);

  /** The chosen services this item has on the price list, in the order they were offered. */
  const pricesFor = (p: PriceItem) =>
    offered.flatMap((slug) => {
      const s = p.services.find((x) => x.slug === slug);
      return s ? [{ slug, s }] : [];
    });

  const shownRaw = searching ? (results.q === q ? results.items : []) : popular;
  const shown = shownRaw.filter((p) => pricesFor(p).length);
  const exact = shownRaw.some((r) => r.name.toLowerCase() === q.toLowerCase());

  function addPriced(p: PriceItem, service: ItemService) {
    const existing = lines.find((l) => l.item === p.name && l.service === service);
    if (existing) {
      onChange(lines.map((l) => (l === existing ? { ...l, quantity: Math.min(MAX_ITEM_QUANTITY, l.quantity + 1) } : l)));
      return;
    }
    if (full) return;
    const options = p.services.map((s) => s.slug).filter(isItemService);
    const prices = Object.fromEntries(p.services.filter((s) => isItemService(s.slug)).map((s) => [s.slug, unitPrice(s)]));
    onChange([...lines, newLine(p.name.slice(0, MAX_ITEM_NAME), options, service, prices)]);
  }

  function addUnpriced(item: string) {
    if (full) return;
    onChange([...lines, newLine(item, offered, offered.length === 1 ? offered[0] : "")]);
    setQuery("");
  }

  const updateLine = (lineId: string, patch: Partial<ItemLine>) => onChange(lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  const removeLine = (lineId: string) => onChange(lines.filter((l) => l.id !== lineId));
  const setQuantity = (lineId: string, value: number) =>
    updateLine(lineId, { quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.round(value) || 1)) });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Never submit the booking from the item search; Enter adds the typed item when nothing matches.
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (typed && status === "ready" && results.q === q && !shown.length) addUnpriced(typed);
  };

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const priced = lines.reduce((sum, l) => sum + (lineUnit(l) ?? 0) * l.quantity, 0);

  const statusText = !searching
    ? ""
    : status === "loading"
      ? t.searching
      : status === "error"
        ? t.error
        : results.q === q && !shown.length && typed
          ? shownRaw.length
            ? t.noneForServices
            : t.notListed
          : "";

  return (
    <div data-booking-items>
      {lines.length ? (
        <>
          <ul aria-label={t.listAria} className="divide-y divide-line border-y border-line">
            {lines.map((l) => {
              const unit = lineUnit(l);
              return (
                <li
                  key={l.id}
                  data-item-line
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_12.5rem_auto_5.5rem_auto]"
                >
                  <span className="min-w-0 break-words font-semibold text-navy md:order-1">{itemName(l.item)}</span>
                  <button
                    type="button"
                    onClick={() => removeLine(l.id)}
                    className="-mr-2 inline-flex size-11 items-center justify-center justify-self-end rounded-md text-secondary hover:bg-soft hover:text-navy md:order-5"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
                      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <span className="sr-only">{format(t.remove, { item: itemName(l.item) })}</span>
                  </button>
                  <div className="relative md:order-2">
                    <select
                      aria-label={format(t.serviceFor, { item: itemName(l.item) })}
                      value={l.service}
                      onChange={(e) => updateLine(l.id, { service: e.target.value as ItemService | "" })}
                      className={`${control} h-11 w-full appearance-none pl-3 pr-9 text-[15px]`}
                    >
                      <option value="">{t.notSure}</option>
                      {l.options.map((slug) => {
                        const p = l.prices[slug];
                        return (
                          <option key={slug} value={slug}>
                            {services[slug] ?? ITEM_SERVICES[slug]}
                            {typeof p === "number" ? ` · ${money(p, locale)}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-navy">
                      <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-self-end md:order-3" role="group" aria-label={format(t.howMany, { item: itemName(l.item) })}>
                    <button
                      type="button"
                      onClick={() => setQuantity(l.id, l.quantity - 1)}
                      disabled={l.quantity <= 1}
                      className={`${control} inline-flex size-11 items-center justify-center rounded-r-none text-lg disabled:opacity-40`}
                    >
                      <span aria-hidden="true">−</span>
                      <span className="sr-only">{t.fewer}</span>
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_ITEM_QUANTITY}
                      aria-label={format(t.numberOf, { item: itemName(l.item) })}
                      value={l.quantity}
                      onChange={(e) => setQuantity(l.id, Number(e.target.value))}
                      className={`${control} -mx-px h-11 w-14 rounded-none text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(l.id, l.quantity + 1)}
                      disabled={l.quantity >= MAX_ITEM_QUANTITY}
                      className={`${control} inline-flex size-11 items-center justify-center rounded-l-none text-lg disabled:opacity-40`}
                    >
                      <span aria-hidden="true">+</span>
                      <span className="sr-only">{t.more}</span>
                    </button>
                  </div>
                  <span className={`text-right tabular-nums md:order-4 ${unit === null ? "t-small text-secondary" : "font-semibold text-navy"}`}>
                    {unit === null ? t.atPickup : money(unit * l.quantity, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p aria-live="polite" className="mt-2 t-small font-semibold text-navy" data-running-total>
            {priced > 0 ? fillCount(count === 1 ? t.runningOne : t.running, count, money(priced, locale), locale) : ""}
          </p>
        </>
      ) : null}

      {full ? (
        <p className="mt-3 t-small text-secondary">{t.full}</p>
      ) : (
        <div className={lines.length ? "mt-4" : ""}>
          <label htmlFor={`${id}-search`} className="block text-[15px] font-semibold text-navy">
            {t.search}
          </label>
          <div className="relative mt-2">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-secondary" />
            <input
              id={`${id}-search`}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={MAX_ITEM_NAME}
              placeholder={t.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              aria-controls={`${id}-list`}
              aria-describedby={`${id}-status`}
              className={`${control} h-[58px] w-full pl-12 pr-4 placeholder:text-secondary/80 md:h-14`}
            />
          </div>
          <p id={`${id}-status`} aria-live="polite" className="mt-1.5 min-h-5 t-small text-secondary">
            {statusText}
          </p>

          {shown.length ? (
            <div className="mt-1">
              <h3 id={`${id}-heading`} className="t-label uppercase text-secondary">
                {searching ? t.results : t.popular}
              </h3>
              <ul id={`${id}-list`} aria-labelledby={`${id}-heading`} className="mt-2 divide-y divide-line rounded-md border border-line bg-white" data-price-list>
                {shown.map((p) => (
                  <li key={p.slug} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3.5 py-2.5 md:px-4">
                    <span className="min-w-0 font-medium text-navy">{p.name}</span>
                    <span className="flex flex-wrap justify-end gap-2">
                      {pricesFor(p).map(({ slug, s }) => {
                        const unit = unitPrice(s);
                        const price = s.amountMinor === null ? t.atPickup : `${money(s.amountMinor, locale)}${s.unitLabel ? ` ${s.unitLabel}` : ""}`;
                        const inList = lines.find((l) => l.item === p.name && l.service === slug);
                        return (
                          <button
                            key={slug}
                            type="button"
                            onClick={() => addPriced(p, slug)}
                            disabled={full && !inList}
                            aria-label={format(t.addAt, { item: p.name, service: services[slug] ?? slug, price })}
                            className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-[14px] transition-colors disabled:opacity-40 ${
                              inList ? "border-blue bg-[#f0f7fc] text-navy" : "border-line-strong text-navy hover:border-navy/50"
                            }`}
                            data-add-service={slug}
                          >
                            {offered.length > 1 ? <span className="text-secondary">{services[slug]}</span> : null}
                            <span className={unit === null ? "text-secondary" : "font-semibold tabular-nums"}>{price}</span>
                            <span aria-hidden="true" className="font-semibold text-action">
                              {inList ? `×${localDigits(inList.quantity, locale)}` : "+"}
                            </span>
                          </button>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {typed && searching && !exact && status !== "loading" ? (
              <button
                type="button"
                onClick={() => addUnpriced(typed)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-[15px] font-semibold text-navy hover:border-navy/50"
              >
                <span aria-hidden="true" className="text-blue">+</span>
                {format(t.addTyped, { typed })}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => addUnpriced(MIXED_ITEM)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-[15px] font-semibold text-navy hover:border-navy/50"
            >
              <span aria-hidden="true" className="text-blue">+</span>
              {t.mix}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fillCount(template: string, n: number, amount: string, locale: Locale) {
  return format(template, { n: localDigits(n, locale), amount });
}
