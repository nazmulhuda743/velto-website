import "server-only";

import { INVOICE_CODE, type InvoiceLineIn } from "./invoice";
import type { ServiceMix } from "./second-service";
import { isSupabaseConfigured, supabaseRpc } from "./supabase-server";

/**
 * Service-role calls for invoice links (docs/technical/sql/website_invoices.sql). The invoice
 * never carries the phone, the address or the full name; the admin list does, and stays in the
 * admin (it is read after requireSection).
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
