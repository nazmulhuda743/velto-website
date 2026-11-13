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

/** One stain staff recorded at drop-off (website_invoice_condition.sql): up to 2 photo paths, `more` not listed. */
export type ConditionMarkIn = { item: string; type: string; photos: string[]; more: number };

/** The only photo paths the page signs: stain photos in the order-photos bucket, nothing that climbs out of it. */
export const CONDITION_PHOTO = /^stains\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;
const safePhoto = (p: unknown): p is string => typeof p === "string" && p.length <= 200 && CONDITION_PHOTO.test(p) && !p.includes("..");

/** The marks as the page shows them: bounded, cleaned, every photo path safe to sign. Anything malformed is dropped. */
export function conditionMarks(raw: unknown): ConditionMarkIn[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).flatMap((m): ConditionMarkIn[] => {
    if (!m || typeof m !== "object") return [];
    const r = m as Record<string, unknown>;
    const item = typeof r.item === "string" ? r.item.trim().slice(0, 80) : "";
    const type = typeof r.type === "string" ? r.type.trim().slice(0, 60) : "";
    if (!item && !type) return [];
    const photos = Array.isArray(r.photos) ? r.photos.filter(safePhoto).slice(0, 2) : [];
    const more = typeof r.more === "number" && Number.isFinite(r.more) ? Math.max(0, Math.min(99, Math.floor(r.more))) : 0;
    return [{ item, type, photos, more }];
  });
}

/** Every photo path to sign, once each. */
export const conditionPhotoPaths = (marks: ConditionMarkIn[]) => [...new Set(marks.flatMap((m) => m.photos))];

/**
 * Storage's answer for one signed path (`/object/sign/order-photos/...?token=...`) as a full URL on the project,
 * or null for anything else (an error row, another bucket, an absolute URL).
 */
export function signedPhotoUrl(origin: string, signed: unknown): string | null {
  if (typeof signed !== "string" || !signed.startsWith("/object/sign/order-photos/stains/") || signed.includes("..")) return null;
  return `${origin.replace(/\/+$/, "")}/storage/v1${signed}`;
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
