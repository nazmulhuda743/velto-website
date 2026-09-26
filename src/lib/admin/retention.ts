import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import { isAdminPreview } from "./preview";
import type { RetentionBucket } from "./retention-messages";

/**
 * Bring-back list (docs/technical/sql/website_retention.sql): who to message today so a
 * first order becomes a second, and a second becomes a routine. Service role only; the
 * phone numbers here never leave the admin server except inside a wa.me link staff open.
 */

export const BUCKETS: RetentionBucket[] = ["second", "due", "winback"];

export type RetentionRow = {
  customerId: string;
  name: string | null;
  phone: string | null;
  zone: string | null;
  orders: number;
  firstOrder: string;
  lastOrder: string;
  lastOrderNumber: string | null;
  lastServices: string[];
  everyDays: number | null;
  dueOn: string | null;
  daysSince: number;
  lastContact: { at: string; outcome: string; staff: string } | null;
};

export type RetentionSummary = {
  customers: number;
  withSecond: number;
  withThird: number;
  medianEveryDays: number | null;
  queue: Record<RetentionBucket, number>;
  messaged7d: number;
  messaged30d: number;
  cameBack30d: number;
};

const safeMessage = (error: unknown) => {
  const m = error instanceof Error ? error.message : "";
  if (/HTTP 404/.test(m)) return "The bring-back list isn't installed in this database yet (docs/technical/sql/website_retention.sql).";
  if (/timeout|abort/i.test(m)) return "The database did not answer in time.";
  return "The bring-back list could not be read right now.";
};

/* Synthetic rows for local design review only (VELTO_ADMIN_PREVIEW in next dev). */
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const previewRows = (bucket: RetentionBucket): RetentionRow[] =>
  [
    { name: "Preview Customer One", phone: "01700000001", zone: "Sector 7", orders: 1, days: 9, every: null, svc: ["Dry Cleaning"] },
    { name: "Preview Customer Two", phone: "01700000002", zone: "Sector 11", orders: 4, days: 13, every: 11, svc: ["Ironing"] },
    { name: "Preview Customer Three", phone: null, zone: null, orders: 2, days: 75, every: 20, svc: ["Wash + Iron", "Ironing"] },
  ].map((p, i) => ({
    customerId: `00000000-0000-4000-8000-00000000000${i}`,
    name: p.name,
    phone: p.phone,
    zone: p.zone,
    orders: bucket === "second" ? 1 : p.orders,
    firstOrder: day(p.days + 40),
    lastOrder: day(p.days),
    lastOrderNumber: `VEL-0${1200 + i}`,
    lastServices: p.svc,
    everyDays: bucket === "second" ? null : p.every,
    dueOn: p.every ? day(p.days - p.every) : null,
    daysSince: p.days,
    lastContact: i === 1 ? { at: new Date(Date.now() - 9 * 86_400_000).toISOString(), outcome: "messaged", staff: "Preview admin" } : null,
  }));

export async function getRetentionSummary(): Promise<Loaded<RetentionSummary>> {
  if (isAdminPreview()) {
    return {
      state: "ok",
      preview: true,
      data: { customers: 722, withSecond: 341, withThird: 222, medianEveryDays: 12, queue: { second: 103, due: 82, winback: 156 }, messaged7d: 14, messaged30d: 40, cameBack30d: 11 },
    };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<RetentionSummary>("website_retention_summary", {}) };
  } catch (error) {
    console.error("admin_retention_summary_failed", error instanceof Error ? error.message : "unknown");
    return { state: "error", message: safeMessage(error) };
  }
}

export async function getRetentionQueue(bucket: RetentionBucket, limit: number): Promise<Loaded<RetentionRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewRows(bucket), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const rows = await supabaseRpc<RetentionRow[]>("website_retention_queue", { p_bucket: bucket, p_limit: limit });
    return { state: "ok", data: Array.isArray(rows) ? rows : [] };
  } catch (error) {
    console.error("admin_retention_queue_failed", error instanceof Error ? error.message : "unknown");
    return { state: "error", message: safeMessage(error) };
  }
}
