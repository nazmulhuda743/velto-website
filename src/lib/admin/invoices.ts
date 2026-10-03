import "server-only";

import { isAdminPreview } from "./preview";
import { invoicesReady, listInvoices, type InvoiceRow } from "../invoice-server";

export type InvoiceList = { state: "ok"; rows: InvoiceRow[]; preview?: boolean } | { state: "not_configured" } | { state: "error"; message: string };

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** Synthetic rows for local visual QA (next dev with VELTO_ADMIN_PREVIEW=1) only. */
const PREVIEW_ROWS: InvoiceRow[] = [
  { orderNumber: "VEL-01431", code: "preview0", name: "Md. Nazmul Hasan", phone: "01711000000", whatsapp: null, status: "Picked", orderDate: hoursAgo(1).slice(0, 10), createdAt: hoursAgo(1), total: 420, due: 220, hasAccount: false, sentAt: null, sentCount: 0, openedAt: null, openCount: 0 },
  { orderNumber: "VEL-01430", code: "preview0", name: "Farhana Akter", phone: "01811000000", whatsapp: "01911000000", status: "Ready", orderDate: hoursAgo(5).slice(0, 10), createdAt: hoursAgo(5), total: 1250, due: 0, hasAccount: true, sentAt: hoursAgo(4), sentCount: 1, openedAt: hoursAgo(3), openCount: 2 },
  { orderNumber: "VEL-01428", code: "preview0", name: null, phone: "01511000000", whatsapp: null, status: "Delivered", orderDate: hoursAgo(26).slice(0, 10), createdAt: hoursAgo(26), total: 180, due: 0, hasAccount: false, sentAt: hoursAgo(25), sentCount: 1, openedAt: null, openCount: 0 },
];

export async function getInvoiceList(days: number, search: string | null): Promise<InvoiceList> {
  if (isAdminPreview()) {
    const q = search?.toLowerCase();
    return { state: "ok", preview: true, rows: q ? PREVIEW_ROWS.filter((r) => r.orderNumber.toLowerCase().includes(q) || r.phone?.includes(q)) : PREVIEW_ROWS };
  }
  if (!invoicesReady()) return { state: "not_configured" };
  try {
    return { state: "ok", rows: (await listInvoices(days, search)) ?? [] };
  } catch (error) {
    console.error("invoice_list_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return { state: "error", message: "Couldn't load orders from Velto Ops. Try again in a moment." };
  }
}
