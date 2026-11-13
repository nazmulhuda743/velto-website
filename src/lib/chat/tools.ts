import "server-only";

import { formatAmount } from "@/lib/format-price";
import { getPricingSource, isPricingConfigured } from "@/lib/integrations/pricing/server";
import type { PublicPriceItem } from "@/lib/integrations/pricing/types";

/** The one tool the chat has: the live public price list (the same view as /pricing). */
export const LOOKUP_PRICES = {
  name: "lookup_prices",
  description:
    "Look up Velto's current prices in the live price list. Use it for every price question. Pass the item names the customer asked about, in English, as they would appear on a laundry price list (for example 'Shirt', 'Saree', 'Blazer', 'Suit', 'Comforter'). Returns each matching item with the price per service; 'after assessment' means Velto confirms the price after seeing the item.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: { type: "string" },
        description: "One to five item names, in English.",
      },
    },
    required: ["items"],
  },
};

/** Validates the model's input (streamed tool input is not validated by the API). */
export function parsePriceInput(input: unknown): string[] | null {
  if (!input || typeof input !== "object") return null;
  const items = (input as { items?: unknown }).items;
  if (!Array.isArray(items) || !items.length) return null;
  const names = items.filter((i): i is string => typeof i === "string").map((i) => i.trim().slice(0, 60)).filter((i) => i.length >= 2);
  return names.length ? names.slice(0, 5) : null;
}

const line = (item: PublicPriceItem) =>
  `${item.name}: ${item.services
    .map((s) => `${s.name} ${s.amountMinor == null ? "after assessment" : `${formatAmount(s.amountMinor)}${s.unitLabel ? ` ${s.unitLabel}` : ""}`}`)
    .join("; ")}`;

/** Runs a lookup and returns the text the model reads. Never throws. */
export async function lookupPrices(names: string[]): Promise<{ text: string; isError: boolean }> {
  if (!isPricingConfigured()) return { text: "The price list is not available right now.", isError: true };
  try {
    const source = getPricingSource();
    const results = await Promise.all(names.map((query) => source.search({ query, limit: 4 })));
    const seen = new Set<string>();
    const out: string[] = [];
    results.forEach((items, i) => {
      if (!items.length) out.push(`${names[i]}: no matching item in the price list.`);
      for (const it of items) {
        if (seen.has(it.slug)) continue;
        seen.add(it.slug);
        out.push(line(it));
      }
    });
    return { text: out.join("\n"), isError: false };
  } catch {
    return { text: "The price list could not be read right now.", isError: true };
  }
}
