/**
 * Price rows and requested changes as the Approvals page shows them. Pure, so it is unit-tested.
 */

export type PriceFields = {
  item_name: string;
  category: string;
  service_category: string;
  price: number | null;
  price_type: "fixed" | "per_sqft" | "poa";
  unit?: string;
  hanger: string | null;
  item_group: string | null;
  note: string | null;
  is_popular: boolean;
};

export type PriceRow = PriceFields & { id: number; item_no: number | null; active: boolean; updated_at: string };

export const PRICE_FIELD_LABELS: Record<keyof PriceFields, string> = {
  item_name: "Item",
  category: "Category",
  service_category: "Service",
  price: "Price",
  price_type: "Price type",
  unit: "Unit",
  hanger: "Hanger",
  item_group: "Group",
  note: "Note",
  is_popular: "Popular",
};

const TYPE_LABEL: Record<string, string> = { fixed: "Fixed", per_sqft: "Per sq ft", poa: "On inspection" };

/** "৳ 1,250" style amounts without depending on the site formatter (pure). */
export function taka(n: number | null | undefined, type?: string) {
  if (type === "poa" || n === null || n === undefined) return "On inspection";
  const whole = Number.isInteger(n) ? String(n) : n.toFixed(2);
  const [a, b] = whole.split(".");
  // South Asian grouping: last three digits, then pairs (1,00,000).
  const grouped = a.length > 3 ? `${a.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${a.slice(-3)}` : a;
  return `৳ ${grouped}${b ? `.${b}` : ""}${type === "per_sqft" ? " / sq ft" : ""}`;
}

export function showValue(field: keyof PriceFields, v: unknown, row?: Partial<PriceFields>): string {
  if (field === "price") return taka(v as number | null, row?.price_type);
  if (field === "price_type") return TYPE_LABEL[String(v)] ?? String(v);
  if (field === "is_popular") return v ? "Yes" : "No";
  if (field === "service_category") return v === "Wash + Iron" ? "Wash & Iron" : String(v ?? "—");
  if (field === "hanger") return v === "must" ? "Must be hung" : v === "request" ? "On request" : "No";
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

/** Fields an edit changes, in a stable order. Unit follows price type, so it isn't listed separately. */
export function priceDiff(before: Partial<PriceFields> | null, after: Partial<PriceFields>) {
  const order: (keyof PriceFields)[] = ["item_name", "service_category", "price", "price_type", "category", "item_group", "hanger", "note", "is_popular"];
  if (!before) return order.filter((f) => after[f] !== undefined && after[f] !== null && after[f] !== "" && !(f === "is_popular" && !after[f])).map((f) => ({ field: f, from: null as string | null, to: showValue(f, after[f], after) }));
  return order
    .filter((f) => {
      const a = before[f] ?? null;
      const b = after[f] ?? null;
      return f === "price" ? (a === null ? null : Number(a)) !== (b === null ? null : Number(b)) : a !== b;
    })
    .map((f) => ({ field: f, from: showValue(f, before[f], before), to: showValue(f, after[f], after) }));
}

/** Percent change for a price edit, for spotting typos (e.g. 12000 instead of 120). */
export function priceJump(before: Partial<PriceFields> | null, after: Partial<PriceFields>): number | null {
  const a = before?.price;
  const b = after.price;
  if (a === null || a === undefined || b === null || b === undefined || Number(a) === 0) return null;
  return Math.round(((Number(b) - Number(a)) / Number(a)) * 100);
}
