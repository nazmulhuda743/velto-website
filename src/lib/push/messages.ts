import type { PushAction, PushMessage } from "./encrypt";

/**
 * What each notification says, in the customer's language. Pure
 * (tests/command-center/push.test.cjs). Links are site paths; Bangla ones start with /bn.
 */
export type PushLang = "bn" | "en";
const BN = "০১২৩৪৫৬৭৮৯";
const digits = (n: number | string, lang: PushLang) => (lang === "bn" ? String(n).replace(/\d/g, (d) => BN[Number(d)]) : String(n));
const path = (p: string, lang: PushLang) => (lang === "bn" ? `/bn${p}` : p);

/** The picture on the right of each notification: one colour and symbol per step (public/notify). */
export const PUSH_ICON = {
  picked: "/notify/picked.png",
  ready: "/notify/ready.png",
  delivered: "/notify/delivered.png",
  reminder: "/notify/reminder.png",
  hello: "/notify/hello.png",
} as const;

/** The two buttons under an order update: open the order, or ring Velto (/go/call). */
const orderButtons = (lang: PushLang): PushAction[] =>
  lang === "bn"
    ? [{ action: "order", title: "অর্ডার দেখুন", url: path("/account", lang) }, { action: "call", title: "Velto-কে কল", url: "/go/call" }]
    : [{ action: "order", title: "View order", url: "/account" }, { action: "call", title: "Call Velto", url: "/go/call" }];

export function orderMessage(status: string, f: { orderNumber: string; items: number | null }, lang: PushLang): PushMessage | null {
  const n = f.items && f.items > 0 ? f.items : null;
  const tag = `order-${f.orderNumber}`;
  const items = n ? (lang === "bn" ? ` · ${digits(n, lang)}টি আইটেম` : ` · ${n} item${n === 1 ? "" : "s"}`) : "";
  const base = { url: path("/account", lang), tag, actions: orderButtons(lang) };
  if (status === "Picked") {
    return lang === "bn"
      ? { ...base, icon: PUSH_ICON.picked, title: "আপনার কাপড় আমরা নিয়েছি", body: `${f.orderNumber}${items}। রেডি হলে জানাব।` }
      : { ...base, icon: PUSH_ICON.picked, title: "We've picked up your clothes", body: `${f.orderNumber}${items}. We'll tell you when they're ready.` };
  }
  if (status === "Ready") {
    return lang === "bn"
      ? { ...base, icon: PUSH_ICON.ready, title: "আপনার কাপড় রেডি ✓", body: `${f.orderNumber}${items}, পরিষ্কার ও চেক করা। শিগগিরই পৌঁছে দেব।` }
      : { ...base, icon: PUSH_ICON.ready, title: "Your clothes are ready ✓", body: `${f.orderNumber}${items}, cleaned and checked. We'll bring them back soon.` };
  }
  if (status === "Delivered") {
    return lang === "bn"
      ? { ...base, icon: PUSH_ICON.delivered, title: "ডেলিভারি হয়েছে, ধন্যবাদ!", body: `${f.orderNumber}। কেমন লাগল? রেটিং দিতে ট্যাপ করুন।` }
      : { ...base, icon: PUSH_ICON.delivered, title: "Delivered. Thank you!", body: `${f.orderNumber}. How was it? Tap to rate.` };
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
  const extra = {
    icon: PUSH_ICON.reminder,
    actions:
      lang === "bn"
        ? [{ action: "book", title: "পিকআপ বুক করুন", url }, { action: "call", title: "Velto-কে কল", url: "/go/call" }]
        : [{ action: "book", title: "Book pickup", url }, { action: "call", title: "Call Velto", url: "/go/call" }],
  };
  if (f.playbook === "onetimer") {
    return lang === "bn"
      ? { title: `${name ? `${name}, ` : ""}প্রথম অর্ডারটা কেমন লাগল?`, body: "আবার লাগলে আগের মতোই পিকআপ, এক ট্যাপে।", url, tag: "reminder", ...extra }
      : { title: `${name ? `${name}, how` : "How"} was your first order?`, body: "When you're ready again, book the same in one tap.", url, tag: "reminder", ...extra };
  }
  if (f.playbook === "seasonal") {
    return lang === "bn"
      ? { title: "শীতের কাপড় পরিষ্কারের সময়", body: "কম্বল, লেপ, জ্যাকেট: পিকআপ এক ট্যাপে।", url, tag: "reminder", ...extra }
      : { title: "Winter's coming", body: "Blankets, comforters and jackets: book a pickup in one tap.", url, tag: "reminder", ...extra };
  }
  return lang === "bn"
    ? { title: `${name ? `${name}, ` : ""}${svc} জমেছে?`, body: "আগের মতোই পিকআপ, এক ট্যাপে বুক করুন।", url, tag: "reminder", ...extra }
    : { title: `${name ? `${name}, time` : "Time"} for your ${svc} pickup?`, body: "Same as last time. One tap to book.", url, tag: "reminder", ...extra };
}

/** Sent once, right after a phone turns notifications on: proof that it works, no test button needed. */
export const welcomeMessage = (lang: PushLang): PushMessage =>
  lang === "bn"
    ? { title: "নোটিফিকেশন চালু হয়েছে", body: "অর্ডারের খবর এভাবেই Velto আপনাকে জানাবে।", url: "/bn/account", tag: "welcome", icon: PUSH_ICON.hello }
    : { title: "Notifications are on", body: "This is how Velto will tell you about your orders.", url: "/account", tag: "welcome", icon: PUSH_ICON.hello };

/** Staff's "Send test notification" from Admin → Customer accounts. */
export const staffTestMessage = (lang: PushLang): PushMessage =>
  lang === "bn"
    ? { title: "Velto থেকে পরীক্ষা", body: "নোটিফিকেশন ঠিকমতো আসছে। এভাবেই অর্ডারের খবর পাবেন।", url: "/bn/account", tag: "staff-test", icon: PUSH_ICON.hello, actions: orderButtons("bn") }
    : { title: "Test from Velto", body: "Notifications are working. This is how your order updates will look.", url: "/account", tag: "staff-test", icon: PUSH_ICON.hello, actions: orderButtons("en") };
