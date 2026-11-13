import "server-only";

import { conditionPhotoPaths, INVOICE_CODE, signedPhotoUrl, type ConditionMarkIn, type InvoiceLineIn } from "./invoice";
import type { ServiceMix } from "./second-service";
import { isSupabaseConfigured, supabaseFetch, supabaseOrigin, supabaseRpc } from "./supabase-server";

/**
 * Service-role calls for invoice links (docs/technical/sql/website_invoices.sql). The invoice
 * never carries the full phone or the house address (website_invoice_customer.sql: name, masked phone, area);
 * the admin list does, and stays in the admin (it is read after requireSection).
 */

export type InvoiceView =
  | { ok: false; reason: "unknown" | "expired"; orderNumber?: string }
  | {
      ok: true;
      orderNumber: string;
      status: string;
      orderDate: string | null;
      pickupDate: string | null;
      deliveryDate: string | null;
      promisedAt: string | null;
      deliveredAt: string | null;
      services: string[] | null;
      express: boolean;
      expressFee: number;
      total: number;
      paid: number;
      due: number;
      paymentStatus: string | null;
      outlet: { code: string; name: string } | null;
      firstName: string | null;
      lines: InvoiceLineIn[];
      payments: { amount: number; method: string | null; on: string | null }[];
      /** website_second_service.sql: the delivered page's invites. Absent before that SQL runs. */
      isFirst?: boolean;
      servicesEver?: ServiceMix | null;
      rating?: number | null;
      asked?: { kind: "routine" | "addon"; service: string; weekday: number | null; window: string | null }[];
      /** website_invoice_customer.sql: full name, masked phone, area. Absent before that SQL runs. */
      customer?: unknown;
      /** website_invoice_condition.sql: the stains recorded at drop-off. Absent before that SQL runs. */
      condition?: unknown;
    };

export type InvoiceRow = {
  orderNumber: string;
  code: string;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  orderDate: string | null;
  createdAt: string;
  total: number;
  due: number;
  hasAccount: boolean;
  sentAt: string | null;
  sentCount: number;
  openedAt: string | null;
  openCount: number;
};

export const invoicesReady = () => isSupabaseConfigured();

export async function getInvoice(code: string): Promise<InvoiceView> {
  if (!INVOICE_CODE.test(code)) return { ok: false, reason: "unknown" };
  return supabaseRpc<InvoiceView>("website_invoice_get", { p_code: code });
}

const PHOTO_TTL_SECONDS = 3600;

/**
 * Signed links (one hour) for the condition photos, keyed by path. The order-photos bucket stays private: the page
 * only ever sees these short-lived links. A failure shows the cards without photos; it never breaks the invoice.
 */
export async function signConditionPhotos(marks: ConditionMarkIn[]): Promise<Record<string, string>> {
  const paths = conditionPhotoPaths(marks);
  if (!paths.length) return {};
  try {
    const res = await supabaseFetch("/storage/v1/object/sign/order-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: PHOTO_TTL_SECONDS, paths }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`invoice photos: signing failed with HTTP ${res.status}`);
      return {};
    }
    const rows = (await res.json()) as unknown;
    const origin = supabaseOrigin();
    const out: Record<string, string> = {};
    if (Array.isArray(rows)) {
      for (const r of rows as { path?: unknown; signedURL?: unknown; error?: unknown }[]) {
        const url = r && !r.error ? signedPhotoUrl(origin, r.signedURL) : null;
        if (url && typeof r.path === "string" && paths.includes(r.path)) out[r.path] = url;
      }
    }
    return out;
  } catch (e) {
    console.warn("invoice photos: signing failed", e instanceof Error ? e.name : "error");
    return {};
  }
}

export const listInvoices = (days: number, search: string | null) =>
  supabaseRpc<InvoiceRow[]>("website_invoice_list", { p_days: days, p_search: search, p_limit: 150 });

export async function markInvoiceSent(code: string, by: string): Promise<boolean> {
  if (!INVOICE_CODE.test(code)) return false;
  return Boolean(await supabaseRpc<boolean>("website_invoice_sent", { p_code: code, p_by: by }));
}

export type LinkResult = { ok: true; again?: boolean; rating?: number } | { ok: false; error: "closed" | "invalid" };

export async function rateInvoice(code: string, rating: number, issues: string[], comment: string | null): Promise<LinkResult> {
  if (!INVOICE_CODE.test(code)) return { ok: false, error: "closed" };
  return supabaseRpc<LinkResult>("website_invoice_rate", { p_code: code, p_rating: rating, p_issues: issues, p_comment: comment });
}

export async function linkRequest(code: string, kind: "routine" | "addon", service: string, weekday: number | null, window: string | null): Promise<LinkResult> {
  if (!INVOICE_CODE.test(code)) return { ok: false, error: "closed" };
  return supabaseRpc<LinkResult>("website_link_request", { p_code: code, p_kind: kind, p_service: service, p_weekday: weekday, p_window: window });
}

export type PhoneMix = ServiceMix & { phone: string };
export const serviceMix = (phones: string[]) => supabaseRpc<PhoneMix[]>("website_service_mix", { p_phones: phones });

export type SecondServiceStats = {
  days: number;
  dcOnly: number;
  dcOnlyAdded: number;
  everydayOnly: number;
  everydayOnlyAdded: number;
  linkRatings: number;
  routineAsks: number;
  addonAsks: number;
};
export const secondServiceStats = (days: number) => supabaseRpc<SecondServiceStats>("website_second_service_stats", { p_days: days });
