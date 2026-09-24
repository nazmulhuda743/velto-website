"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { WhatsAppButton } from "@/components/ui/Button";
import { SearchIcon } from "@/components/ui/icons";
import { track } from "@/components/layout/Analytics";
import { SERVICE_SUMMARY } from "@/content/service-summaries";
import { WHATSAPP_URL } from "@/content/site";
import { formatAmount } from "@/lib/format-price";

/** Mirrors the Codex pricing adapter's PublicPriceItem (via /api/prices). */
type PriceService = {
  slug: string;
  name: string;
  amountMinor: number | null;
  currency: "BDT";
  unitLabel: string | null;
};

type PriceItem = {
  slug: string;
  name: string;
  services: PriceService[];
};

type Source = "mock" | "live";

/** Services that can be booked straight from a result (match /book service slugs). */
const BOOKABLE = new Set(["dry-cleaning", "wash-and-iron", "ironing", "curtain-cleaning", "carpet-cleaning", "blanket-comforter-cleaning"]);

type Status = "idle" | "loading" | "ready" | "empty" | "error";

const EXAMPLES = ["Shirt", "Blazer", "Saree"];

/** Development-only preview hook: ?mockPricing=slow|error (spec §29 states). */
function mockParam() {
  if (process.env.NODE_ENV === "production") return null;
  return new URLSearchParams(window.location.search).get("mockPricing");
}

export function PriceFinder({
  initialQuery = "",
  syncUrl = false,
  bookFromResult,
}: {
  /** Pre-fill and search on load (e.g. /pricing?q=blazer). */
  initialQuery?: string;
  /** Keep ?q= in the address bar in step with the selected item. */
  syncUrl?: boolean;
  /** Show a per-service "Book" action in results. Omitted on the homepage. */
  bookFromResult?: { source: string };
} = {}) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const helpId = `${uid}-help`;

  const [query, setQuery] = useState(initialQuery.slice(0, 64));
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<PriceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<PriceItem | null>(null);
  const [source, setSource] = useState<Source>("mock");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const select = useCallback((item: PriceItem) => {
    setSelected(item);
    setQuery(item.name);
    setOpen(false);
    setActiveIndex(-1);
    track("pricing_search", { section: "find-a-price", item: item.slug });
  }, []);

  const search = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      if (q.trim().length < 2) {
        setStatus("idle");
        setItems([]);
        setOpen(false);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      try {
        const params = new URLSearchParams({ q: q.trim() });
        const mock = mockParam();
        if (mock) params.set("mock", mock);
        const res = await fetch(`/api/prices?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as { items: PriceItem[]; source?: Source };
        setSource(data.source === "live" ? "live" : "mock");
        if (data.items.length === 0) {
          setItems([]);
          setOpen(false);
          setStatus("empty");
          return;
        }
        setItems(data.items);
        setStatus("ready");
        const exact = data.items.find((i) => i.name.toLowerCase() === q.trim().toLowerCase());
        if (exact && data.items.length === 1) {
          select(exact);
        } else {
          setOpen(true);
          setActiveIndex(-1);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setItems([]);
        setOpen(false);
        setStatus("error");
      }
    },
    [select],
  );

  // Debounced search as the user types.
  useEffect(() => {
    if (selected && selected.name === query) return;
    const t = setTimeout(() => search(query), 180);
    return () => clearTimeout(t);
  }, [query, search, selected]);

  useEffect(() => {
    if (selected) track("pricing_view", { section: "find-a-price", item: selected.slug });
  }, [selected]);

  useEffect(() => {
    if (!syncUrl) return;
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("q", selected.slug);
    else if (!query.trim()) url.searchParams.delete("q");
    else return;
    window.history.replaceState(window.history.state, "", url);
  }, [selected, query, syncUrl]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && items.length) select(items[Math.max(activeIndex, 0)]);
    }
  };

  const tryExample = (name: string) => {
    setSelected(null);
    setQuery(name);
    inputRef.current?.focus();
  };

  const showResult = selected && status !== "loading";

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={inputId} className="t-label uppercase text-navy">
          Search an item
        </label>
        <div className="relative mt-3">
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-secondary" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            aria-describedby={helpId}
            value={query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => items.length && !selected && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            className="h-14 w-full rounded-md border border-line-strong bg-white pl-[52px] pr-4 text-base text-navy placeholder:text-secondary hover:border-navy/50 focus:border-blue focus:outline-1 focus:outline-offset-0 focus:outline-blue xl:h-[58px]"
          />
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching items"
            hidden={!open}
            className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-md border border-line bg-white py-1 shadow-[0_12px_32px_-12px_rgba(0,43,78,0.25)]"
          >
            {items.map((item, i) => (
              <li
                key={item.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex h-12 cursor-pointer items-center px-5 text-navy ${
                  i === activeIndex ? "bg-soft" : ""
                }`}
              >
                {item.name}
              </li>
            ))}
          </ul>
        </div>
        <p id={helpId} className="mt-3 t-small text-secondary">
          Try:{" "}
          {EXAMPLES.map((name, i) => (
            <span key={name}>
              <button
                type="button"
                onClick={() => tryExample(name)}
                className="rounded-sm font-medium text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue"
              >
                {name}
              </button>
              {i < EXAMPLES.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      </form>

      <div aria-live="polite" className="mt-8 empty:hidden">
        {status === "loading" ? (
          <div aria-label="Loading prices" role="status" className="rounded-md border border-line bg-white">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between border-t border-line px-5 py-[18px] first:border-t-0">
                <span className="skeleton h-4 w-32" />
                <span className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : null}

        {showResult ? <PriceResult item={selected} source={source} bookFromResult={bookFromResult} /> : null}

        {status === "empty" ? (
          <div className="border-t border-line pt-6">
            <p className="t-h4 text-navy">We couldn&apos;t find that item.</p>
            <p className="mt-2 max-w-[46ch] text-secondary">
              Try another name or WhatsApp Velto and tell us what you need cleaned.
            </p>
            <WhatsAppButton href={WHATSAPP_URL} placement="pricing_no_result" className="mt-5" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="border-t border-line pt-6">
            <p className="t-h4 text-navy">Prices couldn&apos;t load right now.</p>
            <p className="mt-2 max-w-[46ch] text-secondary">
              You can still book a pickup or ask Velto on WhatsApp.
            </p>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={() => search(query)}
                className="inline-flex h-[52px] items-center justify-center rounded-md border border-line-strong bg-white px-6 font-semibold text-navy hover:border-navy lg:h-12"
              >
                Try Again
              </button>
              <WhatsAppButton href={WHATSAPP_URL} placement="pricing_error" />
            </div>
            {bookFromResult ? (
              <p className="mt-4 t-small text-secondary">
                Or{" "}
                <a
                  href={`/book?${new URLSearchParams({ source: `${bookFromResult.source}-error` }).toString()}`}
                  data-analytics="book_pickup_click"
                  data-placement="pricing_error"
                  className="font-semibold text-navy underline decoration-blue/60 underline-offset-4 hover:decoration-blue"
                >
                  book a pickup
                </a>
                . We can go through prices when we call to confirm.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PriceResult({
  item,
  source,
  bookFromResult,
}: {
  item: PriceItem;
  source: Source;
  bookFromResult?: { source: string };
}) {
  return (
    <div className="rounded-md border border-line bg-white">
      <h3 className="px-5 pb-1 pt-5 t-h4 text-navy md:px-6">{item.name}</h3>
      <p className="px-5 pb-4 t-small text-secondary md:px-6">Current Velto price for each service</p>
      <dl>
        {item.services.map((s) => {
          const canBook = bookFromResult && BOOKABLE.has(s.slug);
          const summary = SERVICE_SUMMARY[s.slug];
          return (
            <div key={s.slug} className="flex items-start justify-between gap-4 border-t border-line px-5 py-4 md:px-6">
              <dt className="min-w-0">
                <span className="block font-semibold text-navy">{s.name}</span>
                {summary ? <span className="mt-0.5 block t-small text-secondary">{summary}</span> : null}
                {canBook ? (
                  <a
                    href={`/book?${new URLSearchParams({ service: s.slug, source: bookFromResult.source }).toString()}`}
                    data-analytics="book_pickup_click"
                    data-placement="pricing_result"
                    data-service={s.slug}
                    className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm t-small font-semibold text-navy underline decoration-blue/60 underline-offset-4 hover:decoration-blue"
                  >
                    Book {s.name}
                    <span className="sr-only"> for {item.name}</span>
                    <span aria-hidden="true" className="text-blue no-underline">
                      →
                    </span>
                  </a>
                ) : null}
              </dt>
              <dd className="shrink-0 text-right">
                {s.amountMinor !== null ? (
                  <>
                    <span className="block text-[26px] font-semibold leading-none tracking-[-0.02em] text-navy tabular-nums md:text-[30px]">
                      {formatAmount(s.amountMinor)}
                    </span>
                    {s.unitLabel ? <span className="mt-1 block t-caption text-secondary">{s.unitLabel}</span> : null}
                  </>
                ) : (
                  // Adapter contract: null amount = price needs confirmation (MOCK source never shows a number either).
                  <span data-mock={source === "mock" ? "price" : undefined} className="block pt-0.5 font-semibold text-secondary">
                    On request
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {item.services.some((s) => s.amountMinor === null) ? (
        <p className="border-t border-line px-5 py-3 t-small text-secondary md:px-6">
          &ldquo;On request&rdquo; means we confirm the amount once we see the item. Ask on WhatsApp or add it to a pickup.
        </p>
      ) : null}
    </div>
  );
}
