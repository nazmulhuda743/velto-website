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
