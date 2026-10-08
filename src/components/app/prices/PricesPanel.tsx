"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/app/controls";
import type { PriceRow } from "@/components/app/book/AppBookingFlow";
import { GARMENT_SERVICES, type GarmentService } from "@/lib/booking-items";
import { localDigits, type Locale } from "@/lib/i18n/config";

export type PricesText = { pricesSub: string; pricesFoot: string; searchPlaceholder: string; serviceNames: Record<GarmentService, string> };

/**
 * Prices (design "Prices sheet"): service tabs, search, and per-item prices from the Velto price
 * list. The popular items show first; typing searches the whole list (the same /api/prices as
 * the website). Used in the bottom sheet from Home and Book, and by /app/prices for deep links.
 */
export function PricesPanel({ popular, t, locale }: { popular: PriceRow[]; t: PricesText; locale: Locale }) {
  const [tab, setTab] = useState<GarmentService>("dry-cleaning");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PriceRow[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/prices?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { items?: { name: string; services: { slug: string; amountMinor: number | null }[] }[] } | null) =>
          setFound(
            (body?.items ?? []).map((p) => ({
              name: p.name,
              prices: Object.fromEntries(p.services.filter((s) => (GARMENT_SERVICES as readonly string[]).includes(s.slug) && s.amountMinor !== null).map((s) => [s.slug, s.amountMinor as number])),
            })),
          ),
        )
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const rows = (query.trim().length >= 2 && found ? found : popular).filter((p) => p.prices[tab] !== undefined).slice(0, 30);
  const money = (minor: number) => `৳${localDigits(Math.round(minor / 100), locale)}`;

  return (
    <div className="space-y-3" data-app-prices>
      <p className="a-sec text-muted">{t.pricesSub}</p>
      <Segmented legend={<span className="sr-only">{t.searchPlaceholder}</span>} name="prices-tab" value={tab} onChange={(v) => setTab(v as GarmentService)} options={GARMENT_SERVICES.map((s) => ({ value: s, label: t.serviceNames[s] }))} />
      <label className="flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-line-strong bg-app-card px-3.5">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
        </svg>
        <span className="sr-only">{t.searchPlaceholder}</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="h-full min-w-0 flex-1 bg-transparent a-body outline-none" />
      </label>
      <ul className="overflow-hidden rounded-2xl border border-line bg-app-card">
        {rows.map((p) => (
          <li key={p.name} className="flex min-h-13 items-center justify-between gap-3 border-b border-line px-4 py-3.5 last:border-b-0">
            <span className="a-body text-body">{p.name}</span>
            <span className="a-section">{money(p.prices[tab] ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="a-cap text-muted">{t.pricesFoot}</p>
    </div>
  );
}
