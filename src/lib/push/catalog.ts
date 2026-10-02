import type { PushAction, PushMessage } from "./encrypt";

/**
 * Every customer-facing push, in one place (design doc "Velto — out-of-app push notification
 * system", Oct 2026). This is the mapping layer: an internal event never becomes a sentence except
 * through one of these states. Pure (tests/push-catalog.test.cjs).
 *
 * Rules carried here, so no feature has to remember them:
 * - Class 1 (action required): stays until acted on, the only class with buttons.
 *   Class 2 (update): alerts once, replaced by a newer state in the same lane of the same order.
 *   Class 3 (relationship): silent.
 * - Collapse key = order + lane: the shade holds the current truth, not a log.
 * - Truth rule: requested is never "confirmed", collected never carries a count or price, reported
 *   payment is never "received", ready is never "on the way".
 * - Lock-screen safe: no address, phone, garment description, fault, staff name or internal note.
 *   A payment balance is withheld (P13); amounts appear only where the customer needs them at the
 *   door (P05, P11, P12 balance, P14, P15).
 * - Copy: event first, consequence second. No emoji, no second exclamation mark, no internal id as
 *   the headline unless it is the only way to tell two orders apart.
 */

export type PushLang = "bn" | "en";
export type PushClass = 1 | 2 | 3;
/** What the customer can switch off in Profile → Notifications (care is recommended, not forced). */
export type PushPref = "order" | "pickup" | "care" | "payment" | "reminders" | "offers";
export type PushLane = "pickup" | "order" | "care" | "delivery" | "payment" | "support" | "repeat" | "account";

export type PushStateId =
  | "P01" | "P02" | "P03" | "P04" | "P05" | "P07" | "P08" | "P10" | "P11" | "P12" | "P12b"
  | "P13" | "P14" | "P14r" | "P15" | "P16" | "P16d" | "P17" | "P18" | "P19" | "P20" | "P20s" | "P00";

/** What a state may say. Every field is optional; a state only uses what it is allowed to. */
export type PushContext = {
  /** Which order, in words the customer recognises (see orderLabel). Null when there is only one. */
  label?: string | null;
  orderNumber?: string;
  /** A committed window, e.g. "today, 6–8 PM" / "আজ সন্ধ্যা ৬–৮টা". */
  window?: string;
  /** Expected return day, e.g. "Thursday" / "বৃহস্পতিবার". */
  returnDay?: string;
  garments?: number;
  /** Taka, whole numbers. */
  amount?: number;
  service?: string;
  /** Repeat reminder: the one-tap booking path (/r/<code>). */
  bookPath?: string;
  reason?: string;
};

export type PushDesign = {
  id: PushStateId;
  name: string;
  cls: PushClass;
  lane: PushLane;
  pref: PushPref | null;
  /** When it is sent, in one line (shown in the admin catalogue). */
  when: string;
  /** Not yet wired to an Ops event (see docs/technical/PUSH-NOTIFICATIONS.md, integration plan). */
  live: boolean;
};

const BN = "০১২৩৪৫৬৭৮৯";
const d = (n: number | string, lang: PushLang) => (lang === "bn" ? String(n).replace(/\d/g, (x) => BN[Number(x)]) : String(n));
const tk = (n: number, lang: PushLang) => `৳${d(Math.round(n).toLocaleString("en-US"), lang)}`;
const site = (p: string, lang: PushLang) => (lang === "bn" ? `/bn${p}` : p);

/** The picture on the right: one colour and symbol per kind of news (public/notify). */
export const PUSH_ICON = {
  picked: "/notify/picked.png",
  ready: "/notify/ready.png",
  delivered: "/notify/delivered.png",
  reminder: "/notify/reminder.png",
  hello: "/notify/hello.png",
  attention: "/notify/attention.png",
  payment: "/notify/payment.png",
  support: "/notify/support.png",
} as const;

export const PUSH_DESIGNS: PushDesign[] = [
  { id: "P01", name: "Pickup request received", cls: 2, lane: "pickup", pref: "pickup", when: "A request came from another channel or device (an in-app request sees its own confirmation instead)", live: false },
  { id: "P02", name: "Pickup confirmed", cls: 2, lane: "pickup", pref: "pickup", when: "A rider and a window are both committed", live: false },
  { id: "P03", name: "Rider approaching", cls: 2, lane: "pickup", pref: "pickup", when: "Dispatch marks the rider as approaching (never inferred)", live: false },
  { id: "P04", name: "Laundry collected", cls: 2, lane: "order", pref: "order", when: "Ops marks the order Picked", live: true },
  { id: "P05", name: "Order confirmed", cls: 2, lane: "order", pref: "order", when: "The outlet verifies the count and price", live: false },
  { id: "P07", name: "Approval needed", cls: 1, lane: "care", pref: "care", when: "A garment needs the customer's decision before work continues", live: false },
  { id: "P08", name: "Decision recorded", cls: 2, lane: "care", pref: "care", when: "The decision was made outside the website (phone, WhatsApp)", live: false },
  { id: "P10", name: "Ready", cls: 2, lane: "order", pref: "order", when: "Ops marks the order Ready", live: true },
  { id: "P11", name: "Out for delivery", cls: 2, lane: "order", pref: "pickup", when: "The bag leaves the outlet", live: false },
  { id: "P12", name: "Delivered (settled)", cls: 2, lane: "order", pref: "order", when: "Ops marks the order Delivered and nothing is owed", live: true },
  { id: "P12b", name: "Delivered (balance)", cls: 2, lane: "order", pref: "order", when: "Delivered with an amount still due", live: false },
  { id: "P13", name: "Payment due", cls: 2, lane: "payment", pref: "payment", when: "A delivered order has a balance (amount withheld from the lock screen)", live: false },
  { id: "P14", name: "Payment report received", cls: 2, lane: "payment", pref: "payment", when: "The customer reported a payment; finance has not verified it yet", live: false },
  { id: "P14r", name: "Payment report not verified", cls: 1, lane: "payment", pref: "payment", when: "Finance could not verify a reported payment", live: false },
  { id: "P15", name: "Payment confirmed", cls: 2, lane: "payment", pref: "payment", when: "Finance verified the payment and nothing remains", live: false },
  { id: "P16", name: "Delivery change requested", cls: 2, lane: "delivery", pref: "pickup", when: "The customer asked to move a delivery; not yet confirmed", live: false },
  { id: "P16d", name: "Delivery change declined", cls: 2, lane: "delivery", pref: "pickup", when: "The requested move could not be made", live: false },
  { id: "P17", name: "Delivery updated", cls: 2, lane: "delivery", pref: null, when: "A confirmed schedule change (sent even if routine updates are off)", live: false },
  { id: "P18", name: "Delivery not completed", cls: 1, lane: "delivery", pref: "pickup", when: "The rider could not hand the order over", live: false },
  { id: "P19", name: "Service recovery update", cls: 1, lane: "support", pref: "care", when: "A reported problem's case changed materially", live: false },
  { id: "P20", name: "Usual pickup reminder", cls: 3, lane: "repeat", pref: "reminders", when: "The repeat engine says an established customer is due", live: true },
  { id: "P20s", name: "Another pickup? (no pattern yet)", cls: 3, lane: "repeat", pref: "reminders", when: "Due, but two orders are not a habit yet", live: true },
  { id: "P00", name: "Notifications are on", cls: 2, lane: "account", pref: null, when: "Right after a phone turns notifications on, and the staff test", live: true },
];

/**
 * The friendliest label that tells this order apart from the customer's other live orders:
 * nothing (one order) → the service → the garment count → the order number (last resort).
 */
export function orderLabel(
  live: { orderNumber: string; service?: string | null; garments?: number | null }[],
  orderNumber: string,
  lang: PushLang,
): string | null {
  const me = live.find((o) => o.orderNumber === orderNumber);
  if (!me || live.length <= 1) return null;
  const others = live.filter((o) => o.orderNumber !== orderNumber);
  if (me.service && others.every((o) => o.service && o.service !== me.service)) return me.service;
  if (me.garments && others.every((o) => o.garments && o.garments !== me.garments)) return lang === "bn" ? `${d(me.garments, lang)}টি কাপড়ের` : `${me.garments}-garment`;
  return orderNumber;
}

/** "Your order" / "Your Iron Only order" / "Order VEL-01482" (and Bangla). */
function yourOrder(c: PushContext, lang: PushLang): string {
  const l = c.label;
  if (!l) return lang === "bn" ? "আপনার অর্ডার" : "Your order";
  if (/^VELR?-\d+$/.test(l)) return lang === "bn" ? `অর্ডার ${l}` : `Order ${l}`;
  return lang === "bn" ? `আপনার ${l} অর্ডার` : `Your ${l} order`;
}

type Copy = { title: string; body: string };

function copy(id: PushStateId, c: PushContext, lang: PushLang): Copy {
  const bn = lang === "bn";
  const g = c.garments;
  const win = c.window;
  const amt = c.amount;
  switch (id) {
    case "P01":
      return bn
        ? { title: "পিকআপের অনুরোধ পেয়েছি", body: "রাইডার আর সময় শিগগিরই নিশ্চিত করে জানাব।" }
        : { title: "Pickup request received", body: "We have your request. We will confirm the rider and the time shortly." };
    case "P02":
      return bn
        ? { title: "পিকআপ নিশ্চিত", body: win ? `আমরা ${win} আপনার কাপড় নিতে আসব।` : "রাইডার ঠিক হয়েছে। সময় পিকআপ পেজে দেখুন।" }
        : { title: "Pickup confirmed", body: win ? `We will collect your laundry ${win}.` : "Your rider is booked. See the time on your pickup page." };
    case "P03":
      return bn
        ? { title: "রাইডার আসছেন", body: "Velto-র রাইডার পথে আছেন। ব্যাগটা তৈরি রাখুন।" }
        : { title: "Your pickup is approaching", body: "Your Velto rider is on the way. Please have your bag ready." };
    case "P04":
      return bn
        ? { title: "কাপড় নিয়ে এসেছি", body: "আপনার ব্যাগ Velto-তে। যাচাইয়ের পর কাপড়ের সংখ্যা আর দাম জানাব।" }
        : { title: "Laundry collected", body: "Your bag is with Velto. We will confirm the garment count and price after verification." };
    case "P05":
      return bn
        ? { title: `অর্ডার নিশ্চিত${g ? ` · ${d(g, lang)}টি কাপড়` : ""}${amt ? ` · ${tk(amt, lang)}` : ""}`, body: `আউটলেটে যাচাই হয়েছে।${c.returnDay ? ` ফেরত ${c.returnDay}।` : ""}` }
        : { title: `Order confirmed${g ? ` · ${g} garments` : ""}${amt ? ` · ${tk(amt, lang)}` : ""}`, body: `Verified at the outlet.${c.returnDay ? ` Expected return ${c.returnDay}.` : ""}` };
    case "P07":
      return bn
        ? { title: `আপনার সিদ্ধান্ত দরকার${c.label ? ` · ${c.label}` : ""}`, body: "একটা কাপড়ের ব্যাপারে আপনার সিদ্ধান্ত লাগবে। Velto খুলে দেখুন।" }
        : { title: `Your approval is needed${c.label ? ` · ${c.label} order` : ""}`, body: "One garment needs your decision before we continue. Open Velto to review it." };
    case "P08":
      return bn
        ? { title: "সিদ্ধান্ত পেয়েছি", body: `আপনার পছন্দ লিখে রেখেছি। অর্ডারের কাজ চলছে${c.returnDay ? `, ফেরত এখনও ${c.returnDay}` : ""}।` }
        : { title: "Decision received", body: `We have recorded your choice. Your order continues${c.returnDay ? `, with delivery still expected ${c.returnDay}` : ""}.` };
    case "P10":
      return bn
        ? { title: `${yourOrder(c, lang)} রেডি`, body: `${g ? `${d(g, lang)}টি কাপড়ই শেষ চেক পেরিয়েছে। ` : ""}${win ? `ডেলিভারি ${win}।` : "ডেলিভারির সময় শিগগিরই জানাব।"}` }
        : { title: `${yourOrder(c, lang)} is ready`, body: `${g ? `All ${g} garments have passed final checks. ` : ""}${win ? `Delivery ${win}.` : "We will confirm your delivery window shortly."}` };
    case "P11":
      return bn
        ? { title: `${yourOrder(c, lang)} পথে`, body: `${win ? `আপনার ${win} সময়ের মধ্যে পৌঁছাবে।` : "আজই পৌঁছাবে।"}${amt ? ` বাকি ${tk(amt, lang)}।` : ""}` }
        : { title: `${yourOrder(c, lang)} is on the way`, body: `${win ? `Arriving in your ${win} window.` : "Arriving today."}${amt ? ` Amount due ${tk(amt, lang)}.` : ""}` };
    case "P12":
      return bn
        ? { title: `ডেলিভারি হয়েছে${g ? ` · ${d(g, lang)}টি কাপড় ফেরত` : ""}`, body: "Velto বেছে নেওয়ার জন্য ধন্যবাদ।" }
        : { title: `Delivered${g ? ` · ${g} garments returned` : ""}`, body: "Thank you for choosing Velto." };
    case "P12b":
      return bn
        ? { title: `ডেলিভারি হয়েছে${g ? ` · ${d(g, lang)}টি কাপড় ফেরত` : ""}`, body: `এই অর্ডারে এখনও ${amt ? tk(amt, lang) : "কিছু টাকা"} বাকি আছে।` }
        : { title: `Delivered${g ? ` · ${g} garments returned` : ""}`, body: `A balance of ${amt ? tk(amt, lang) : "some money"} remains on this order.` };
    case "P13":
      // Two payloads in the design; a website can't tell a locked phone, so the balance is never sent.
      return bn
        ? { title: "পেমেন্টের খবর", body: "পেমেন্টের বিস্তারিত দেখতে Velto খুলুন।" }
        : { title: "Payment update", body: "Open Velto to view your payment details." };
    case "P14":
      return bn
        ? { title: "পেমেন্টের তথ্য পেয়েছি", body: `আপনার ${amt ? `${tk(amt, lang)} ` : ""}পেমেন্ট যাচাই করছি। হয়ে গেলে জানাব।` }
        : { title: "Payment report received", body: `We are verifying your ${amt ? `${tk(amt, lang)} ` : ""}payment. We will confirm once it clears.` };
    case "P14r":
      return bn
        ? { title: "পেমেন্ট যাচাই করা যায়নি", body: `${c.reason ? `${c.reason}। ` : ""}ঠিক করতে Velto খুলুন।` }
        : { title: "We could not verify your payment report", body: `${c.reason ? `${c.reason}. ` : ""}Open Velto to correct it.` };
    case "P15":
      return bn
        ? { title: `পেমেন্ট নিশ্চিত${amt ? ` · ${tk(amt, lang)}` : ""}`, body: "যাচাই হয়েছে। এই অর্ডারে আর কিছু বাকি নেই।" }
        : { title: `Payment confirmed${amt ? ` · ${tk(amt, lang)}` : ""}`, body: "Verified. No balance remains on this order." };
    case "P16":
      return bn
        ? { title: "ডেলিভারি বদলের অনুরোধ পেয়েছি", body: "দেখছি। নিশ্চিত না করা পর্যন্ত আগের সময়ই থাকছে।" }
        : { title: "Change request received", body: "We are reviewing your delivery change. Your current window stays in place until we confirm." };
    case "P16d":
      return bn
        ? { title: "ডেলিভারির সময় বদলানো গেল না", body: `${win ? `আপনার ${win} সময়ই থাকছে। ` : "আগের সময়ই থাকছে। "}অন্য সময় দেখতে Velto খুলুন।` }
        : { title: "We could not move your delivery", body: `${win ? `Your ${win} window stands. ` : "Your current window stands. "}Open Velto to see other times.` };
    case "P17":
      return bn
        ? { title: "ডেলিভারির সময় বদলেছে", body: win ? `নতুন সময়: ${win}।` : "নতুন সময় Velto-তে দেখুন।" }
        : { title: "Delivery updated", body: win ? `Your new window is ${win}.` : "See your new window in Velto." };
    case "P18":
      return bn
        ? { title: "ডেলিভারি সম্পূর্ণ করা যায়নি", body: "আপনার কাপড় Velto-তে নিরাপদে আছে। কখন ফেরত চান বেছে নিন।" }
        : { title: "We could not complete your delivery", body: "Your garments are safe with Velto. Choose when you would like them returned." };
    case "P19":
      return bn
        ? { title: "আমরা বিষয়টা দেখছি", body: "আপনার জানানো সমস্যার নতুন খবর আছে। আমাদের প্রস্তাব দেখতে Velto খুলুন।" }
        : { title: "We are taking care of this", body: "There is an update on the issue you reported. Open Velto to see what we propose." };
    case "P20":
      return bn
        ? { title: "নিয়মিত পিকআপের সময় হয়েছে?", body: `আপনার নিয়মিত ${c.service ?? "লন্ড্রি"} পিকআপ আবার বুক করা যায়।` }
        : { title: "Time for your usual pickup?", body: `Your usual ${c.service ?? "laundry"} pickup is ready to book again.` };
    case "P20s":
      return bn
        ? { title: "আবার পিকআপ লাগবে?", body: "কয়েক ট্যাপেই পরের Velto পিকআপ বুক করুন।" }
        : { title: "Ready for another pickup?", body: "Book your next Velto pickup in a few taps." };
    case "P00":
      return bn
        ? { title: "নোটিফিকেশন চালু হয়েছে", body: "অর্ডারের খবর এভাবেই Velto আপনাকে জানাবে।" }
        : { title: "Notifications are on", body: "This is how Velto will tell you about your orders." };
  }
}

/** Where a tap lands: the thing the push is about, never just the home page. */
function link(id: PushStateId, c: PushContext, lang: PushLang): string {
  const order = c.orderNumber ? `/account/orders/${encodeURIComponent(c.orderNumber)}` : "/account";
  switch (id) {
    case "P01": case "P02": case "P03":
      return site("/account#pickups", lang);
    case "P07": case "P08":
      return site(`${order}#care`, lang);
    case "P12b": case "P13": case "P14": case "P14r": case "P15":
      return site(`${order}#payment`, lang);
    case "P16": case "P16d": case "P17": case "P18":
      return site(`${order}#delivery`, lang);
    case "P19":
      return site("/account#help", lang);
    case "P20": case "P20s":
      return c.bookPath ?? site("/book", lang);
    case "P00":
      return site("/account", lang);
    default:
      return site(order, lang);
  }
}

function icon(id: PushStateId): string {
  if (["P01", "P02", "P03", "P04", "P11"].includes(id)) return PUSH_ICON.picked;
  if (["P05", "P08", "P10"].includes(id)) return PUSH_ICON.ready;
  if (["P12", "P12b"].includes(id)) return PUSH_ICON.delivered;
  if (["P07", "P14r", "P18"].includes(id)) return PUSH_ICON.attention;
  if (["P13", "P14", "P15"].includes(id)) return PUSH_ICON.payment;
  if (["P16", "P16d", "P17"].includes(id)) return PUSH_ICON.picked;
  if (id === "P19") return PUSH_ICON.support;
  if (id === "P20" || id === "P20s") return PUSH_ICON.reminder;
  return PUSH_ICON.hello;
}

/** Class 1 only: one button that opens the exact screen. Nothing is decided from the shade. */
function actions(id: PushStateId, url: string, lang: PushLang): PushAction[] | undefined {
  const bn = lang === "bn";
  if (id === "P07") return [{ action: "open", title: bn ? "সিদ্ধান্ত দেখুন" : "Review decision", url }];
  if (id === "P18") return [{ action: "open", title: bn ? "নতুন সময় বেছে নিন" : "Choose a new time", url }];
  if (id === "P14r") return [{ action: "open", title: bn ? "ঠিক করুন" : "Correct it", url }];
  if (id === "P19") return [{ action: "open", title: bn ? "খবর দেখুন" : "See the update", url }];
  return undefined;
}

export const designOf = (id: PushStateId) => PUSH_DESIGNS.find((x) => x.id === id)!;

/**
 * The notification for one state. `seq` orders states of the same lane (a late, older push is
 * dropped by the service worker); defaults to the time of sending.
 */
export function renderPush(id: PushStateId, c: PushContext, lang: PushLang, seq = Date.now()): PushMessage {
  const design = designOf(id);
  const { title, body } = copy(id, c, lang);
  const url = link(id, c, lang);
  const key = c.orderNumber ?? (design.lane === "repeat" ? "repeat" : design.lane === "account" ? "account" : "customer");
  return {
    title,
    body,
    url,
    tag: `${key}:${design.lane}`,
    icon: icon(id),
    actions: actions(id, url, lang),
    cls: design.cls,
    lane: design.lane,
    order: c.orderNumber,
    seq,
    state: id,
  };
}

/** Words and patterns no Velto push may contain (design doc "Banned copy"). Checked in tests. */
export function copyProblems(m: Pick<PushMessage, "title" | "body">): string[] {
  const text = `${m.title}\n${m.body}`;
  const problems: string[] = [];
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push("emoji");
  if (/!.*!/s.test(text)) problems.push("second exclamation mark");
  if (/status updated|moved to processing|moved to ironing|QC completed|assigned to outlet|manager approved|we miss you|haven't ordered in/i.test(text)) problems.push("banned phrase");
  if (/^(Order\s+)?VELR?-\d+\b/.test(m.title) && !/^Order VELR?-\d+ is /.test(m.title)) problems.push("order code as headline");
  if (/01[3-9]\d{8}|House\s+\d|Road\s+\d/i.test(text)) problems.push("address or phone");
  return problems;
}
