import { dhakaDay } from "./insights";

export type RevenueRange = { key: "30d" | "90d" | "365d" | "custom"; from: string; to: string; label: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 730;

/** Revenue ranges are Dhaka calendar days; Ops history is not limited by analytics retention. */
export function parseRevenueRange(p: { range?: string; from?: string; to?: string }, now = new Date()): RevenueRange {
  const today = dhakaDay(now);
  const minus = (d: number) => dhakaDay(new Date(now.getTime() - d * 86_400_000));
  if (p.range === "custom" && p.from && p.to && DAY.test(p.from) && DAY.test(p.to) && p.from <= p.to) {
    const earliest = minus(MAX_DAYS);
    const from = p.from < earliest ? earliest : p.from;
    const to = p.to > today ? today : p.to;
    if (from <= to) return { key: "custom", from, to, label: `${from} → ${to}` };
  }
  if (p.range === "30d") return { key: "30d", from: minus(29), to: today, label: "Last 30 days" };
  if (p.range === "365d") return { key: "365d", from: minus(364), to: today, label: "Last 12 months" };
  return { key: "90d", from: minus(89), to: today, label: "Last 90 days" };
}

export const money = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `৳${Math.round(v).toLocaleString("en-US")}`;

export const roas = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);

export const CLASSIFICATION_LABELS = { acquired: "Acquired", reactivated: "Reactivated", existing: "Existing" } as const;
export const METHOD_LABELS: Record<string, string> = {
  staff_order_link: "Staff-linked order",
  exact_phone: "Exact phone",
  whatsapp_reference: "WhatsApp reference",
};
