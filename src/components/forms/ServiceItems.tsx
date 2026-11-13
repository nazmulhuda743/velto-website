"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/ui/icons";
import type { FormText } from "@/content/i18n/forms/en";
import { fill, format, localDigits, type Locale } from "@/lib/i18n/config";
import {
  BOOKING_ITEMS_BY_SERVICE,
  cleanItemName,
  isItemService,
  itemPrice,
  MAX_BOOKING_ITEMS,
  MAX_ITEM_NAME,
  MAX_ITEM_QUANTITY,
  MIXED_ITEM,
  offeredFor,
  type ItemService,
} from "@/lib/booking-items";
import { lineUnit, money, newLine, unitPrice, type ItemLine, type PriceItem } from "./BookingItems";

/** Items shown before "More items". */
const FIRST = 6;

const control =
  "rounded-md border border-line-strong bg-white text-navy hover:border-navy/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:opacity-40";

/**
 * Step 2 of Book a Pickup, one panel per chosen service: that service's items with their price and
 * a + / − count, more items behind "More items", a search of the price list for anything else
 * (only items Velto does for this service), and any item added as typed. Counting is optional:
 * Velto counts and prices everything at pickup. Item names stay as the price list has them.
 */
export function ServiceItems({
  service,
  label,
  t,
  fromText,
  searchText,
  lines,
  onChange,
  popular,
  mixedLabel,
  locale,
}: {
  service: ItemService;
  /** The service's name in the page language. */
  label: string;
  t: FormText["booking"]["items"];
  /** "From {amount}" in the page language. */
  fromText: string;
  /** "Find another {service} item" in the page language. */
  searchText: string;
  /** Every line in the booking (this panel shows and changes its own service's lines). */
  lines: ItemLine[];
  onChange: (lines: ItemLine[]) => void;
  /** The price list's entries for the panels, read on the server; empty when prices are unavailable. */
  popular: PriceItem[];
  mixedLabel: string;
  locale: Locale;
}) {
  const id = useId();
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; items: PriceItem[] }>({ q: "", items: [] });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const q = query.trim();
  const searching = q.length >= 2;
  const typed = cleanItemName(query) ?? "";
  const full = lines.length >= MAX_BOOKING_ITEMS;

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

  const mine = lines.filter((l) => l.service === service);
  const lineFor = (name: string) => mine.find((l) => l.item === name);
  const shownName = (item: string) => (item === MIXED_ITEM ? mixedLabel : item);

  // The service's own items: with prices when the list is up (and only those Velto does for this
  // service), by name otherwise, so the customer can still say what's coming.
  const listed = new Map(popular.map((p) => [p.name, p]));
  const catalogue = BOOKING_ITEMS_BY_SERVICE[service].flatMap((name) => {
    const p = listed.get(name);
    if (p && !offeredFor(p, service)) return [];
    return [{ name, p: p ?? null }];
  });
  const names = new Set(catalogue.map((c) => c.name));
  // Lines added another way (search, typed, an earlier order) come first.
  const extra = mine.filter((l) => !names.has(l.item)).map((l) => ({ name: l.item, p: null as PriceItem | null, line: l }));
  const hidden = !all && catalogue.slice(FIRST).every((c) => !lineFor(c.name)) && catalogue.length > FIRST;
  const rows = hidden ? catalogue.slice(0, FIRST) : catalogue;

  function setQty(name: string, p: PriceItem | null, quantity: number) {
    const existing = lineFor(name);
    if (quantity <= 0) {
      if (existing) onChange(lines.filter((l) => l !== existing));
      return;
    }
    const n = Math.min(MAX_ITEM_QUANTITY, quantity);
    if (existing) {
      onChange(lines.map((l) => (l === existing ? { ...l, quantity: n } : l)));
      return;
    }
    if (full) return;
    const slugs = p ? p.services.map((s) => s.slug).filter(isItemService) : [];
    const options = [...new Set([...slugs, service])];
    const prices = p ? Object.fromEntries(p.services.filter((s) => isItemService(s.slug)).map((s) => [s.slug, unitPrice(s)])) : {};
    onChange([...lines, newLine(name.slice(0, MAX_ITEM_NAME), options, service, prices, n)]);
  }

  const priceText = (p: PriceItem | null, line?: ItemLine) => {
    const own = line ? lineUnit(line) : null;
    if (own !== null) return `${money(own, locale)} ${t.each}`;
    const price = p ? itemPrice(p, service) : null;
    if (!price) return t.atPickup;
    const amount = money(price.amountMinor, locale);
    if (price.exact) return `${amount} ${t.each}`;
    return `${fill(fromText, { amount }, locale)}${price.unitLabel ? ` ${price.unitLabel}` : ""}`;
  };

  const row = (name: string, p: PriceItem | null, key: string) => {
    const line = lineFor(name);
    const qty = line?.quantity ?? 0;
    const shown = shownName(name);
    return (
      <li key={key} className="flex items-center justify-between gap-3 px-3.5 py-2.5 md:px-4" data-item-row={name}>
        <span className="min-w-0">
          <span className="block break-words font-medium text-navy">{shown}</span>
          <span className="block t-small tabular-nums text-secondary">{priceText(p, line)}</span>
        </span>
        {qty ? (
          <span className="flex shrink-0 items-center" role="group" aria-label={format(t.howMany, { item: shown })}>
            <button type="button" onClick={() => setQty(name, p, qty - 1)} className={`${control} inline-flex size-11 items-center justify-center rounded-r-none text-lg`}>
              <span aria-hidden="true">−</span>
              <span className="sr-only">{qty === 1 ? format(t.remove, { item: shown }) : t.fewer}</span>
            </button>
            <output aria-live="polite" className="-mx-px inline-flex h-11 min-w-11 items-center justify-center border-y border-line-strong bg-[#f0f7fc] px-2 font-semibold tabular-nums text-navy">
              {localDigits(qty, locale)}
            </output>
            <button
              type="button"
              onClick={() => setQty(name, p, qty + 1)}
              disabled={qty >= MAX_ITEM_QUANTITY}
              className={`${control} inline-flex size-11 items-center justify-center rounded-l-none text-lg`}
            >
              <span aria-hidden="true">+</span>
              <span className="sr-only">{t.more}</span>
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setQty(name, p, 1)}
            disabled={full}
            aria-label={format(t.addAt, { item: shown, service: label, price: priceText(p) })}
            className={`${control} inline-flex min-h-11 shrink-0 items-center gap-1.5 px-4 text-[15px] font-semibold`}
            data-add-item
          >
            <span aria-hidden="true" className="text-action">
              +
            </span>
            {t.add}
          </button>
        )}
      </li>
    );
  };

  const found = searching && results.q === q ? results.items.filter((p) => offeredFor(p, service)).slice(0, 5) : [];
  const exact = found.some((p) => p.name.toLowerCase() === q.toLowerCase()) || names.has(typed) || Boolean(lineFor(typed));
  const statusText = !searching ? "" : status === "loading" ? t.searching : status === "error" ? t.error : results.q === q && !found.length && typed ? t.notListed : "";
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Never submit the booking from the item search; Enter adds the typed item when nothing matches.
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (typed && status === "ready" && results.q === q && !found.length && !exact) {
      setQty(typed, null, 1);
      setQuery("");
    }
  };

  const count = mine.reduce((n, l) => n + l.quantity, 0);
  const priced = mine.reduce((sum, l) => sum + (lineUnit(l) ?? 0) * l.quantity, 0);

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-line bg-white" data-service-items={service}>
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-3.5 py-3 md:px-4">
        <h3 id={`${id}-title`} className="font-semibold text-navy">
          {label}
        </h3>
        <p aria-live="polite" className="t-small font-semibold tabular-nums text-navy" data-service-total>
          {count ? (priced > 0 ? format(count === 1 ? t.runningOne : t.running, { n: localDigits(count, locale), amount: money(priced, locale) }) : format(count === 1 ? t.countOne : t.count, { n: localDigits(count, locale) })) : ""}
        </p>
      </header>
      <ul aria-labelledby={`${id}-title`} className="divide-y divide-line">
        {extra.map((x) => row(x.name, x.p, `extra-${x.line.id}`))}
        {rows.map((c) => row(c.name, c.p, c.name))}
      </ul>
      <div className="border-t border-line px-3.5 pb-3 pt-2 md:px-4">
        {hidden ? (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="inline-flex min-h-11 items-center text-[15px] font-semibold text-navy underline decoration-blue/60 underline-offset-[6px] hover:decoration-blue"
          >
            {t.showMore}
          </button>
        ) : null}
        <label htmlFor={`${id}-search`} className="mt-1 block text-[15px] font-semibold text-navy">
          {fill(searchText, { service: label }, locale)}
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
            aria-describedby={`${id}-status`}
            className="h-12 w-full rounded-md border border-line-strong bg-white pl-12 pr-4 text-base text-navy placeholder:text-muted hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue"
          />
        </div>
        <p id={`${id}-status`} aria-live="polite" className="mt-1.5 min-h-5 t-small text-secondary">
          {statusText}
        </p>
        {found.length ? (
          <ul aria-label={t.results} className="mt-1 divide-y divide-line rounded-md border border-line">
            {found.map((p) => row(p.name, p, `found-${p.slug}`))}
          </ul>
        ) : null}
        {typed && searching && !exact && status !== "loading" ? (
          <button
            type="button"
            onClick={() => {
              setQty(typed, null, 1);
              setQuery("");
            }}
            disabled={full}
            className={`${control} mt-2 inline-flex min-h-11 items-center gap-2 px-4 text-[15px] font-semibold`}
          >
            <span aria-hidden="true" className="text-action">
              +
            </span>
            {format(t.addTyped, { typed })}
          </button>
        ) : null}
      </div>
    </section>
  );
}
