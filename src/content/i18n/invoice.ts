import type { Locale } from "@/lib/i18n/config";

/** The invoice page opened from WhatsApp (/i/<code>). Order words come from the account text. */
const en = {
  metaTitle: "Your Velto invoice",
  label: "Invoice",
  hi: "For {name}",
  itemsTitle: "Items",
  qty: "Qty",
  each: "{price} each",
  priceLater: "Priced at the outlet",
  subtotal: "Items",
  express: "Express service",
  discount: "Discount",
  otherCharges: "Other charges",
  paymentsTitle: "Payments",
  paidOn: "{amount} · {method} · {day}",
  /** Ops payment methods (payments_method_check); anything else is shown as it comes. */
  methods: { Cash: "Cash", Bkash: "bKash", Nagad: "Nagad", Card: "Card", "Bank Transfer": "Bank transfer", COD: "Cash on delivery" } as Record<string, string>,
  print: "Save as PDF / print",
  keepTitle: "Keep every order in one place",
  keepBody: "Sign in with this number (one SMS code). You'll see all your orders and invoices, follow each order, and book your next pickup in one tap.",
  keepButton: "Sign in to my account",
  openTitle: "This order is in your account",
  openButton: "Open in my account",
  question: "Question about this invoice?",
  whatsapp: "Hi Velto, I have a question about the invoice for order {n}.",
  expiredTitle: "This link has expired",
  expiredBody: "Invoices open by link for 120 days. Sign in with your number to see all your orders and invoices.",
  unknownTitle: "We couldn't find this invoice",
  unknownBody: "Check that the link is complete, or message Velto on WhatsApp and we'll send it again.",
  preview: "Example invoice (for checking the design)",
};

export type InvoiceText = typeof en;

const bn: InvoiceText = {
  metaTitle: "আপনার Velto ইনভয়েস",
  label: "ইনভয়েস",
  hi: "{name}-এর জন্য",
  itemsTitle: "আইটেম",
  qty: "সংখ্যা",
  each: "প্রতিটি {price}",
  priceLater: "শাখায় দাম ঠিক হবে",
  subtotal: "আইটেম",
  express: "এক্সপ্রেস সার্ভিস",
  discount: "ছাড়",
  otherCharges: "অন্যান্য চার্জ",
  paymentsTitle: "পেমেন্ট",
  paidOn: "{amount} · {method} · {day}",
  methods: { Cash: "ক্যাশ", Bkash: "বিকাশ", Nagad: "নগদ", Card: "কার্ড", "Bank Transfer": "ব্যাংক ট্রান্সফার", COD: "ডেলিভারিতে ক্যাশ" },
  print: "PDF হিসেবে সেভ / প্রিন্ট",
  keepTitle: "সব অর্ডার এক জায়গায় রাখুন",
  keepBody: "এই নম্বর দিয়ে সাইন ইন করুন (একটা SMS কোড)। আপনার সব অর্ডার আর ইনভয়েস দেখতে পাবেন, প্রতিটি অর্ডারের খবর পাবেন, আর পরের পিকআপ এক ট্যাপে বুক করতে পারবেন।",
  keepButton: "অ্যাকাউন্টে সাইন ইন করুন",
  openTitle: "এই অর্ডারটি আপনার অ্যাকাউন্টে আছে",
  openButton: "আমার অ্যাকাউন্টে খুলুন",
  question: "এই ইনভয়েস নিয়ে প্রশ্ন আছে?",
  whatsapp: "হ্যালো Velto, অর্ডার {n}-এর ইনভয়েস নিয়ে আমার একটি প্রশ্ন আছে।",
  expiredTitle: "এই লিংকের মেয়াদ শেষ",
  expiredBody: "ইনভয়েস লিংক ১২০ দিন খোলা যায়। আপনার নম্বর দিয়ে সাইন ইন করলে সব অর্ডার আর ইনভয়েস দেখতে পাবেন।",
  unknownTitle: "ইনভয়েসটি পাওয়া যায়নি",
  unknownBody: "লিংকটি পুরো আছে কিনা দেখুন, অথবা WhatsApp-এ Velto-কে মেসেজ করুন, আমরা আবার পাঠিয়ে দেব।",
  preview: "নমুনা ইনভয়েস (ডিজাইন দেখার জন্য)",
};

export const invoiceText = (locale: Locale): InvoiceText => (locale === "bn" ? bn : en);
