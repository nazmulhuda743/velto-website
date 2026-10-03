import { PricingUpstreamError } from "./errors";
import type { PublicPriceItem, PublicPriceService } from "./types";

const PUBLIC_ROW_KEYS = [
  "item_slug",
  "item_name",
  "service_slug",
  "service_name",
  "price_amount_minor",
  "currency",
  "unit_label",
] as const;

type PricingRow = {
  item_slug: string;
  item_name: string;
  service_slug: string;
  service_name: string;
  price_amount_minor: number | null;
  currency: "BDT";
  unit_label: string | null;
};

function hasOnlyPublicKeys(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  return (
    keys.length === PUBLIC_ROW_KEYS.length &&
    keys.every((key) => (PUBLIC_ROW_KEYS as readonly string[]).includes(key))
  );
}

function isPricingRow(value: unknown): value is PricingRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;

  return (
    hasOnlyPublicKeys(row) &&
    typeof row.item_slug === "string" &&
    typeof row.item_name === "string" &&
    typeof row.service_slug === "string" &&
    typeof row.service_name === "string" &&
    (row.price_amount_minor === null ||
      (typeof row.price_amount_minor === "number" &&
        Number.isSafeInteger(row.price_amount_minor) &&
        row.price_amount_minor >= 0)) &&
    row.currency === "BDT" &&
    (row.unit_label === null || typeof row.unit_label === "string")
  );
}

export function parsePublicPricingRows(payload: unknown): PublicPriceItem[] {
  if (!Array.isArray(payload) || !payload.every(isPricingRow)) {
    throw new PricingUpstreamError("Pricing source contract mismatch");
  }

  const items = new Map<string, PublicPriceItem>();
  for (const row of payload) {
    let item = items.get(row.item_slug);
    if (!item) {
      item = { slug: row.item_slug, name: row.item_name, services: [] };
      items.set(row.item_slug, item);
    }

    const service: PublicPriceService = {
      slug: row.service_slug,
      name: row.service_name,
      amountMinor: row.price_amount_minor,
      currency: row.currency,
      unitLabel: row.unit_label,
    };
    item.services.push(service);
  }

  return [...items.values()];
}

/** The words of a search, lower-case (at most 4, so the upstream filter stays small). */
export function searchWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4);
}

/**
 * Best match first: the exact name, then names that start with the search, then names with a
 * word that starts with it, then the rest; shorter names before longer ones, then A–Z. So "suit"
 * shows "Suit (1pc)" before "B. Kameez Suit (2pc)", and "suit 1pc" finds "Suit (1pc)".
 */
export function rankPriceItems(items: PublicPriceItem[], query: string): PublicPriceItem[] {
  const words = searchWords(query);
  const q = words.join(" ");
  const plain = (name: string) => name.toLowerCase().replace(/[^a-z0-9&+\- ]+/g, " ").replace(/\s+/g, " ").trim();
  const score = (name: string) => {
    const n = plain(name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (words.length && n.startsWith(words[0])) return 2;
    if (n.split(" ").some((w) => w.startsWith(words[0] ?? ""))) return 3;
    return 4;
  };
  return items
    .filter((item) => words.every((w) => plain(item.name).includes(w)))
    .map((item) => ({ item, s: score(item.name) }))
    .sort((a, b) => a.s - b.s || a.item.name.length - b.item.name.length || a.item.name.localeCompare(b.item.name))
    .map((x) => x.item);
}
