import type { PushMessage } from "./encrypt";

/**
 * What each notification says, in the customer's language. Pure
 * (tests/command-center/push.test.cjs). Links are site paths; Bangla ones start with /bn.
 */
export type PushLang = "bn" | "en";
const BN = "০১২৩৪৫৬৭৮৯";
const digits = (n: number | string, lang: PushLang) => (lang === "bn" ? String(n).replace(/\d/g, (d) => BN[Number(d)]) : String(n));
const path = (p: string, lang: PushLang) => (lang === "bn" ? `/bn${p}` : p);

export function orderMessage(status: string, f: { orderNumber: string; items: number | null }, lang: PushLang): PushMessage | null {
  const n = f.items && f.items > 0 ? f.items : null;
  const tag = `order-${f.orderNumber}`;
  if (status === "Picked") {
    return lang === "bn"
      ? { title: "আপনার কাপড় আমরা নিয়েছি", body: `অর্ডার ${f.orderNumber}${n ? `: ${digits(n, lang)}টি আইটেম` : ""}। রেডি হলে জানাব।`, url: path("/account", lang), tag }
      : { title: "We've picked up your clothes", body: `Order ${f.orderNumber}${n ? `: ${n} item${n === 1 ? "" : "s"}` : ""}. We'll tell you when they're ready.`, url: "/account", tag };
  }
  if (status === "Ready") {
    return lang === "bn"
      ? { title: "আপনার কাপড় রেডি", body: `অর্ডার ${f.orderNumber} পরিষ্কার ও চেক করা হয়েছে। শিগগিরই পৌঁছে দেব।`, url: path("/account", lang), tag }
      : { title: "Your clothes are ready", body: `Order ${f.orderNumber} is cleaned and checked. We'll bring it back soon.`, url: "/account", tag };
  }
  if (status === "Delivered") {
    return lang === "bn"
      ? { title: "ডেলিভারি হয়েছে, ধন্যবাদ!", body: `অর্ডার ${f.orderNumber}। কেমন লাগল? রেটিং দিতে ট্যাপ করুন।`, url: path("/account", lang), tag }
      : { title: "Delivered. Thank you!", body: `Order ${f.orderNumber}. How was it? Tap to rate.`, url: "/account", tag };
  }
  return null;
}

const SERVICE: Record<string, Record<PushLang, string>> = {
  Ironing: { bn: "আয়রনের কাপড়", en: "ironing" },
  "Wash + Iron": { bn: "ধোয়ার কাপড়", en: "wash & iron" },
  "Dry Cleaning": { bn: "ড্রাই ক্লিনিংয়ের কাপড়", en: "dry cleaning" },
};

/** The reminder as a notification; it opens the same one-tap page as the SMS link. */
export function reminderMessage(
  f: { firstName: string | null; service: string | null; code: string; playbook?: "regular_due" | "onetimer" | "seasonal" },
  lang: PushLang,
): PushMessage {
  const svc = SERVICE[f.service ?? ""]?.[lang] ?? (lang === "bn" ? "লন্ড্রির কাপড়" : "laundry");
  const name = f.firstName?.trim().split(/\s+/)[0] ?? "";
  const url = lang === "bn" ? `/bn/r/${f.code}` : `/r/${f.code}`;
  if (f.playbook === "onetimer") {
    return lang === "bn"
      ? { title: `${name ? `${name}, ` : ""}প্রথম অর্ডারটা কেমন লাগল?`, body: "আবার লাগলে আগের মতোই পিকআপ, এক ট্যাপে।", url, tag: "reminder" }
      : { title: `${name ? `${name}, how` : "How"} was your first order?`, body: "When you're ready again, book the same in one tap.", url, tag: "reminder" };
  }
  if (f.playbook === "seasonal") {
    return lang === "bn"
      ? { title: "শীতের কাপড় পরিষ্কারের সময়", body: "কম্বল, লেপ, জ্যাকেট: পিকআপ এক ট্যাপে।", url, tag: "reminder" }
      : { title: "Winter's coming", body: "Blankets, comforters and jackets: book a pickup in one tap.", url, tag: "reminder" };
  }
  return lang === "bn"
    ? { title: `${name ? `${name}, ` : ""}${svc} জমেছে?`, body: "আগের মতোই পিকআপ, এক ট্যাপে বুক করুন।", url, tag: "reminder" }
    : { title: `${name ? `${name}, time` : "Time"} for your ${svc} pickup?`, body: "Same as last time. One tap to book.", url, tag: "reminder" };
}

/** Sent once, right after a phone turns notifications on: proof that it works, no test button needed. */
export const welcomeMessage = (lang: PushLang): PushMessage =>
  lang === "bn"
    ? { title: "নোটিফিকেশন চালু হয়েছে", body: "অর্ডারের খবর এভাবেই Velto আপনাকে জানাবে।", url: "/bn/account", tag: "welcome" }
    : { title: "Notifications are on", body: "This is how Velto will tell you about your orders.", url: "/account", tag: "welcome" };

/** Staff's "Send test notification" from Admin → Customer accounts. */
export const staffTestMessage = (lang: PushLang): PushMessage =>
  lang === "bn"
    ? { title: "Velto থেকে পরীক্ষা", body: "নোটিফিকেশন ঠিকমতো আসছে। এভাবেই অর্ডারের খবর পাবেন।", url: "/bn/account", tag: "staff-test" }
    : { title: "Test from Velto", body: "Notifications are working. This is how your order updates will look.", url: "/account", tag: "staff-test" };
