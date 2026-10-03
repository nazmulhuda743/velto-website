/**
 * Invoice links (docs/technical/INVOICES.md): the sums the invoice page shows and the WhatsApp
 * message staff send. Pure and runtime-neutral, so the page, the admin list and the unit tests
 * share it (tests/command-center/invoice.test.cjs).
 */
import { greetingName } from "./customer/validation";

export type InvoiceLang = "bn" | "en";

export type InvoiceLineIn = { item: string; service: string | null; quantity: number; price: number | null };
export type InvoiceLine = InvoiceLineIn & { amount: number | null };

export type InvoiceSums = {
  lines: InvoiceLine[];
  /** Sum of the item lines, when every line has a price. */
  subtotal: number | null;
  express: number;
  /**
   * What Ops charged beyond (positive) or below (negative) the item lines and the express fee:
   * a discount or another charge. Null when a line has no price (then only the total is shown).
   */
  adjustment: number | null;
};

const money = (n: number) => Math.round(n * 100) / 100;

export function invoiceSums(lines: InvoiceLineIn[], total: number, expressFee: number): InvoiceSums {
  const out = lines.map((l) => ({ ...l, amount: typeof l.price === "number" ? money(l.price * l.quantity) : null }));
  const priced = out.length > 0 && out.every((l) => l.amount !== null);
  const subtotal = priced ? money(out.reduce((s, l) => s + (l.amount ?? 0), 0)) : null;
  const express = Math.max(0, expressFee || 0);
  const adjustment = subtotal === null ? null : money(total - subtotal - express);
  return { lines: out, subtotal, express, adjustment };
}

/** Invoice codes, as the database makes them (website_invoice_code). */
export const INVOICE_CODE = /^[A-Za-z0-9_-]{8}$/;

/** The one link in the message. https:// so WhatsApp always makes it tappable. */
export function invoiceLink(siteUrl: string, code: string, lang: InvoiceLang) {
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}${lang === "bn" ? "/bn" : ""}/i/${code}`;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const digits = (s: string, lang: InvoiceLang) => (lang === "bn" ? s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : s);
const tk = (n: number, lang: InvoiceLang) => digits(`৳${Math.round(n).toLocaleString("en-US")}`, lang);

export type InvoiceMessageFacts = { name: string | null; orderNumber: string; status: string; total: number; due: number; link: string };

/**
 * The WhatsApp message for one order: exactly one link (the invoice), the total and what is
 * still due. Staff can edit it in WhatsApp before sending.
 */
export function invoiceMessage(f: InvoiceMessageFacts, lang: InvoiceLang): string {
  const first = greetingName(f.name);
  const cancelled = f.status === "Cancelled";
  if (lang === "en") {
    const hi = first ? `Hi ${first}, this is Velto.` : "Hi, this is Velto.";
    const money = cancelled ? "" : f.due > 0 ? ` Total ${tk(f.total, lang)}, due ${tk(f.due, lang)}.` : ` Total ${tk(f.total, lang)}, paid in full.`;
    return `${hi} Your invoice for order ${f.orderNumber}:${money}\n${f.link}\nSign in there with this number to see all your orders and invoices in one place.`;
  }
  const hi = first ? `হ্যালো ${first}, Velto থেকে বলছি।` : "হ্যালো, Velto থেকে বলছি।";
  const money = cancelled ? "" : f.due > 0 ? ` মোট ${tk(f.total, lang)}, বাকি ${tk(f.due, lang)}।` : ` মোট ${tk(f.total, lang)}, পুরোটা পরিশোধিত।`;
  return `${hi} আপনার অর্ডার ${f.orderNumber}-এর ইনভয়েস:${money}\n${f.link}\nএই নম্বর দিয়ে সেখানে সাইন ইন করলে আপনার সব অর্ডার আর ইনভয়েস এক জায়গায় দেখতে পাবেন।`;
}

/** How many links a message carries (the rule: at most one). */
export const linkCount = (text: string) => (text.match(/https?:\/\/\S+/g) ?? []).length;
