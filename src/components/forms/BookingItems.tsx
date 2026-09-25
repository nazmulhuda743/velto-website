"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/ui/icons";
import {
  cleanItemName,
  ITEM_SERVICES,
  isItemService,
  MAX_BOOKING_ITEMS,
  MAX_ITEM_NAME,
  MAX_ITEM_QUANTITY,
  MIXED_ITEM,
  type ItemService,
} from "@/lib/booking-items";

/** One line in the booking form. `options` are the services this item can have (all of them for mixed/typed items). */
export type ItemLine = {
  id: string;
  item: string;
  service: ItemService | "";
  quantity: number;
  options: ItemService[];
};

type PriceItem = { slug: string; name: string; services: { slug: string }[] };

const ALL_SERVICES = Object.keys(ITEM_SERVICES) as ItemService[];

let lineCounter = 0;
export function newLine(item: string, options: ItemService[], preferred?: string): ItemLine {
  const service = preferred && isItemService(preferred) && options.includes(preferred) ? preferred : options.length === 1 ? options[0] : "";
  lineCounter += 1;
  return { id: `line-${lineCounter}`, item, service, quantity: 1, options };
}

const control =
  "rounded-md border border-line-strong bg-white text-base text-navy hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue";

/**
 * Step 1 of Book a Pickup: what's being sent, as optional lines of item + service + quantity.
 * Items come from Velto's price list (/api/prices), so names and services match Ops; anything
 * not listed can be added as typed, and "A mix, or not sure" adds a catch-all line.
 */
export function BookingItems({
  lines,
  onChange,
  preferredService,
}: {
  lines: ItemLine[];
  onChange: (lines: ItemLine[]) => void;
  /** Arrived from a service page: new lines start on that service when the item has it. */
  preferredService?: string;
}) {
  const [query, setQuery] = useState("");
  // Results remember the query they answer, so a slower earlier search never shows for a newer one.
  const [results, setResults] = useState<{ q: string; items: PriceItem[] }>({ q: "", items: [] });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  // The list closes shortly after blur (so a tap on an option still lands); refocusing cancels that.
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openList = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const full = lines.length >= MAX_BOOKING_ITEMS;
  const typed = cleanItemName(query);

  const q = query.trim();
  const searching = q.length >= 2;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/prices?${new URLSearchParams({ q })}`, { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as { items?: PriceItem[] };
        setResults({ q, items: (data.items ?? []).filter((i) => i.services.some((s) => isItemService(s.slug))) });
        setStatus("ready");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults({ q, items: [] });
        setStatus("error");
      }
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, searching]);

  // Suggestions from the price list, then "add as typed" when nothing matches exactly.
  const shown = searching && results.q === q ? results.items : [];
  const exact = shown.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());
  const choices: { key: string; label: string; add: () => void }[] = [
    ...shown.map((r) => ({
      key: r.slug,
      label: r.name,
      add: () => add(r.name.slice(0, MAX_ITEM_NAME), r.services.map((s) => s.slug).filter(isItemService)),
    })),
    ...(typed && !exact
      ? [{ key: "typed", label: `Add “${typed}”`, add: () => add(typed, ALL_SERVICES) }]
      : []),
  ];
  const listOpen = open && searching && choices.length > 0;

  function add(item: string, options: ItemService[]) {
    if (full) return;
    onChange([...lines, newLine(item, options.length ? options : ALL_SERVICES, preferredService)]);
    setQuery("");
    setOpen(false);
    setActive(-1);
    document.getElementById(`${listId}-input`)?.focus();
  }

  const updateLine = (id: string, patch: Partial<ItemLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => onChange(lines.filter((l) => l.id !== id));
  const setQuantity = (id: string, value: number) =>
    updateLine(id, { quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.round(value) || 1)) });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && choices.length) {
      e.preventDefault();
      openList();
      setActive((i) => (i + 1) % choices.length);
    } else if (e.key === "ArrowUp" && choices.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? choices.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      // Never submit the booking from the item search.
      e.preventDefault();
      // Nothing highlighted: the exact price-list match, else the typed text.
      const pick =
        choices[active] ??
        choices.find((c) => c.label.toLowerCase() === q.toLowerCase()) ??
        choices.find((c) => c.key === "typed") ??
        (choices.length === 1 ? choices[0] : undefined);
      pick?.add();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div data-booking-items>
      <p id={`${listId}-help`} className="t-small text-secondary">
        Add what you&apos;re sending, with a service and how many. Not sure? Skip this, or add a mix.
      </p>

      {lines.length ? (
        <ul aria-label="Items in this pickup" className="mt-3 divide-y divide-line border-y border-line">
          {lines.map((l) => (
            <li key={l.id} data-item-line className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_12rem_auto_auto]">
              <span className="min-w-0 break-words font-semibold text-navy md:order-1">{l.item}</span>
              <button
                type="button"
                onClick={() => removeLine(l.id)}
                className="-mr-2 inline-flex size-11 items-center justify-center justify-self-end rounded-md text-secondary hover:bg-soft hover:text-navy md:order-4"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="sr-only">Remove {l.item}</span>
              </button>
              <div className="relative md:order-2">
                <select
                  aria-label={`Service for ${l.item}`}
                  value={l.service}
                  onChange={(e) => updateLine(l.id, { service: e.target.value as ItemService | "" })}
                  className={`${control} h-11 w-full appearance-none pl-3 pr-9 text-[15px]`}
                >
                  <option value="">Not sure</option>
                  {l.options.map((slug) => (
                    <option key={slug} value={slug}>
                      {ITEM_SERVICES[slug]}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-navy">
                  <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex items-center justify-self-end md:order-3" role="group" aria-label={`How many ${l.item}`}>
                <button
                  type="button"
                  onClick={() => setQuantity(l.id, l.quantity - 1)}
                  disabled={l.quantity <= 1}
                  className={`${control} inline-flex size-11 items-center justify-center rounded-r-none text-lg disabled:opacity-40`}
                >
                  <span aria-hidden="true">−</span>
                  <span className="sr-only">One fewer</span>
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_ITEM_QUANTITY}
                  aria-label={`Number of ${l.item}`}
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
                  <span className="sr-only">One more</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? (
        <p className="mt-3 t-small text-secondary">That&apos;s the most items for one request. Add anything else in a note.</p>
      ) : (
        <div className="mt-3">
          <label htmlFor={`${listId}-input`} className="block text-[15px] font-semibold text-navy">
            {lines.length ? "Add another item" : "Add an item"}
          </label>
          <div className="relative mt-2">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-secondary" />
            <input
              id={`${listId}-input`}
              type="text"
              role="combobox"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={MAX_ITEM_NAME}
              placeholder="e.g. shirt, pant, saree, blanket"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                openList();
                setActive(-1);
              }}
              onFocus={openList}
              onBlur={() => {
                closeTimer.current = setTimeout(() => setOpen(false), 150);
              }}
              onKeyDown={onKeyDown}
              aria-expanded={listOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
              aria-describedby={`${listId}-help`}
              className={`${control} h-[54px] w-full pl-12 pr-4 placeholder:text-secondary/80 md:h-[52px]`}
            />
            {listOpen ? (
              <ul id={listId} role="listbox" aria-label="Matching items" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-line-strong bg-white py-1 shadow-[0_12px_32px_rgba(0,49,83,0.14)]">
                {choices.map((c, i) => (
                  <li
                    key={c.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={c.add}
                    className={`flex min-h-11 cursor-pointer items-center px-4 text-[15px] text-navy ${i === active ? "bg-[#f0f7fc]" : "hover:bg-soft"} ${c.key === "typed" ? "font-semibold" : ""}`}
                  >
                    {c.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <p aria-live="polite" className="mt-1.5 min-h-5 t-small text-secondary">
            {!searching
              ? ""
              : status === "loading"
              ? "Searching the price list…"
              : status === "error"
                ? "The item list isn't loading right now. Type the item and add it as written."
                : status === "ready" && results.q === q && !shown.length && typed
                  ? "Not on the price list? Add it as written."
                  : ""}
          </p>
          <button
            type="button"
            onClick={() => add(MIXED_ITEM, ALL_SERVICES)}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-[15px] font-semibold text-navy hover:border-navy/50"
          >
            <span aria-hidden="true" className="text-blue">+</span>
            A mix, or not sure
          </button>
        </div>
      )}
    </div>
  );
}
