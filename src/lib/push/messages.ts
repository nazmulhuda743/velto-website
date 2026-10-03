import { renderPush, type PushLang } from "./catalog";
import type { PushMessage } from "./encrypt";

/**
 * The notifications that are live today, in the customer's language, built from the catalogue
 * (catalog.ts: copy, class, collapse key, icon, link). Pure (tests/command-center/push.test.cjs).
 */
export type { PushLang };

/**
 * Ops order status → the customer's push. Picked never carries a count (the rider's count is
 * provisional); Delivered stays neutral about money because the event doesn't carry the balance yet.
 */
export function orderMessage(status: string, f: { orderNumber: string; items: number | null }, lang: PushLang): PushMessage | null {
  const garments = f.items && f.items > 0 ? f.items : undefined;
  if (status === "Picked") return renderPush("P04", { orderNumber: f.orderNumber }, lang);
  if (status === "Ready") return renderPush("P10", { orderNumber: f.orderNumber, garments }, lang);
  if (status === "Delivered") return renderPush("P12", { orderNumber: f.orderNumber, garments }, lang);
  return null;
}

/**
 * Care approval (Ops wash-risk advisory): "approval needed" when an order starts waiting, the same
 * card again as each reminder (it replaces itself), and "decision received" when Velto recorded the
 * decision by phone or WhatsApp. The garment and its fault never appear: they are behind sign-in.
 */
export function careMessage(step: string, orderNumber: string, lang: PushLang): PushMessage | null {
  if (step === "pending" || step === "reminder1" || step === "reminder2") return renderPush("P07", { orderNumber }, lang);
  if (step === "decided") return renderPush("P08", { orderNumber }, lang);
  return null;
}

const SERVICE: Record<string, Record<PushLang, string>> = {
  Ironing: { bn: "আয়রন", en: "Iron Only" },
  "Wash + Iron": { bn: "ওয়াশ ও আয়রন", en: "Wash & Iron" },
  "Dry Cleaning": { bn: "ড্রাই ক্লিনিং", en: "Dry Cleaning" },
};

/**
 * The repeat reminder (class 3, silent). It opens the same one-tap page as the SMS link. An
 * established customer hears about "your usual" service; someone without a pattern yet is asked,
 * not told. The seasonal note is about the season, not about them.
 */
export function reminderMessage(
  f: { firstName: string | null; service: string | null; code: string; playbook?: "regular_due" | "onetimer" | "seasonal" },
  lang: PushLang,
): PushMessage {
  const bookPath = lang === "bn" ? `/bn/r/${f.code}` : `/r/${f.code}`;
  if (f.playbook === "seasonal") {
    const base = renderPush("P20s", { bookPath }, lang);
    return lang === "bn"
      ? { ...base, title: "শীতের কাপড় পরিষ্কারের সময়", body: "কম্বল, লেপ, জ্যাকেট: পিকআপ কয়েক ট্যাপে।" }
      : { ...base, title: "Time for winter bedding", body: "Blankets, comforters and jackets: book a pickup in a few taps." };
  }
  const service = SERVICE[f.service ?? ""]?.[lang];
  if (f.playbook === "onetimer" || !service) return renderPush("P20s", { bookPath }, lang);
  return renderPush("P20", { bookPath, service }, lang);
}

/** Sent once, right after a phone turns notifications on: proof that it works, no test button needed. */
export const welcomeMessage = (lang: PushLang): PushMessage => renderPush("P00", {}, lang);

/** Staff's "Send test notification" from Admin → Customer accounts. */
export const staffTestMessage = (lang: PushLang): PushMessage => {
  const base = renderPush("P00", {}, lang);
  return lang === "bn"
    ? { ...base, tag: "account:staff-test", title: "Velto থেকে পরীক্ষা", body: "নোটিফিকেশন ঠিকমতো আসছে। এভাবেই অর্ডারের খবর পাবেন।" }
    : { ...base, tag: "account:staff-test", title: "Test from Velto", body: "Notifications are working. This is how your order updates will look." };
};
