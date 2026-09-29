/**
 * One booking request, start to finish, on one card (/admin/requests). Pure, so it is unit-tested.
 *
 * The first four steps are the request's own pickup job (website_dispatch_jobs, see
 * docs/technical/sql/website_dispatch_stages.sql). After "Picked up" the card follows the Velto
 * Ops order linked to it and that order's delivery job. Nothing here writes; it only decides
 * what the card shows and which step comes next.
 */
import { greetingName } from "../customer/validation";
import { dayName, SLOTS, type DispatchJob, type SlotId } from "./dispatch-logic";

export const FLOW = [
  { key: "new", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "assigned", label: "Assigned" },
  { key: "picked", label: "Picked up" },
  { key: "process", label: "In process" },
  { key: "ready", label: "Ready" },
  { key: "delivery", label: "Delivery planned" },
  { key: "delivered", label: "Delivered" },
] as const;
export type FlowKey = (typeof FLOW)[number]["key"];

/** The linked Ops order, as website_dispatch_context returns it. */
export type LinkedOrder = {
  status: string;
  orderDate: string | null;
  deliveryDate: string | null;
  total: number | null;
  due: number | null;
  items: number | null;
  updatedAt: string;
};

/** A phone's history in Ops (website_dispatch_context). */
export type CustomerContext = {
  orders: number;
  lastOrder: string | null;
  recent: { orderNumber: string; status: string; orderDate: string | null; createdAt: string }[];
};

export type FlowState = {
  key: FlowKey;
  /** Position in FLOW (the last step reached, for a closed request). */
  index: number;
  closed: null | "cancelled" | "merged";
};

const at = (key: FlowKey) => FLOW.findIndex((s) => s.key === key);

/** Where a request stands, from its pickup job, the linked order and that order's delivery job. */
export function flowState(job: DispatchJob, order?: LinkedOrder | null, delivery?: DispatchJob | null): FlowState {
  const reached = (key: FlowKey, closed: FlowState["closed"] = null): FlowState => ({ key, index: at(key), closed });
  switch (job.stage) {
    case "cancelled":
    case "merged":
      return reached(job.confirmed_at ? (job.assignee_id && job.slot_date ? "assigned" : "confirmed") : "new", job.stage);
    case "new":
      return reached("new");
    case "assigned":
      // A person or a slot, not both: still being arranged.
      return reached(job.confirmed_at ? "confirmed" : "new");
    case "confirmed":
      return reached("confirmed");
    case "scheduled":
      return reached("assigned");
  }
  // Collected ("picked", or "done" from before that stage existed): follow the order.
  if (!order) return reached("picked");
  if (order.status === "Cancelled") return reached("process", "cancelled");
  if (order.status === "Delivered") return reached("delivered");
  if (order.status === "Out for Delivery") return reached("delivery");
  if (order.status === "Ready") {
    return delivery && delivery.assignee_id && delivery.slot_date ? reached("delivery") : reached("ready");
  }
  return reached("process");
}

/** Open and waiting on staff (not waiting on the outlet or the customer). */
export const needsAction = (s: FlowState) => !s.closed && (s.key === "new" || s.key === "confirmed" || s.key === "assigned" || s.key === "picked" || s.key === "ready");

/**
 * How late the first call is. A new request should be called within 30 minutes; after 24 hours
 * it is overdue. Only "new" requests are timed.
 */
export function callTimer(job: DispatchJob, now = Date.now()): { minutes: number; tone: "ok" | "soon" | "late" } | null {
  if (job.stage !== "new") return null;
  const minutes = Math.max(0, Math.floor((now - Date.parse(job.created_at)) / 60_000));
  return { minutes, tone: minutes < 30 ? "ok" : minutes < 24 * 60 ? "soon" : "late" };
}

/** "12 min", "3 h", "2 days". */
export function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (24 * 60))} days`;
}

/**
 * Ops orders that could be the one made from this request: the same phone, created from the day
 * before the request on. Newest first, at most three.
 */
export function orderCandidates(job: DispatchJob, ctx: CustomerContext | null | undefined): CustomerContext["recent"] {
  if (!ctx) return [];
  const from = Date.parse(job.created_at) - 86_400_000;
  return ctx.recent.filter((o) => Date.parse(o.createdAt) >= from).slice(0, 3);
}

/* ---------- WhatsApp messages (staff can still edit them in WhatsApp before sending) ---------- */

export type Lang = "bn" | "en";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bnNum = (s: string | number) => String(s).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const BN_DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
/** The same windows as dispatch-logic SLOTS and the booking form (9–12, 12–4, 4–8). */
const BN_SLOTS: Record<SlotId, string> = {
  morning: "সকাল (৯টা–১২টা)",
  afternoon: "দুপুর (১২টা–৪টা)",
  evening: "বিকেল–সন্ধ্যা (৪টা–৮টা)",
};

/** "২৮ সেপ্টেম্বর, সোমবার" or "Mon 28 Sep". */
export function dayText(iso: string, lang: Lang) {
  if (lang === "en") return dayName(iso);
  const d = new Date(`${iso}T00:00:00Z`);
  return `${bnNum(d.getUTCDate())} ${BN_MONTHS[d.getUTCMonth()]}, ${BN_DAYS[d.getUTCDay()]}`;
}

/** "Afternoon (12–4 PM)" or "দুপুর (১২টা–৪টা)". */
export function slotText(slot: SlotId, lang: Lang) {
  if (lang === "bn") return BN_SLOTS[slot];
  const s = SLOTS.find((x) => x.id === slot)!;
  return `${s.label} (${s.hours})`;
}

const hello = (name: string | null, lang: Lang) => {
  const first = greetingName(name);
  return lang === "en" ? (first ? `Hello ${first}, this is Velto.` : "Hello, this is Velto.") : first ? `আসসালামু আলাইকুম ${first}, Velto থেকে বলছি।` : "আসসালামু আলাইকুম, Velto থেকে বলছি।";
};

/** After the call: the agreed day and time of day, and who is coming when that is known. */
export function confirmMessage(f: { name: string | null; date: string; slot: SlotId; rider: string | null }, lang: Lang) {
  if (lang === "en") {
    const who = f.rider ? ` ${f.rider} from our team will come to collect it.` : "";
    return `${hello(f.name, lang)} Your pickup is confirmed for ${dayText(f.date, lang)}, ${slotText(f.slot, lang)}.${who} If anything changes, just reply here. Thank you!`;
  }
  const who = f.rider ? ` আমাদের ${f.rider} কাপড় নিতে আসবেন।` : "";
  return `${hello(f.name, lang)} আপনার পিকআপ কনফার্ম হয়েছে: ${dayText(f.date, lang)}, ${slotText(f.slot, lang)}।${who} কোনো পরিবর্তন হলে এই মেসেজের উত্তর দিন। ধন্যবাদ!`;
}

const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

/** A routine pickup request (website_routines): confirm the weekly day before activating it. */
export function routineMessage(f: { name: string | null; weekday: number; slot: SlotId }, lang: Lang) {
  if (lang === "en") {
    const day = WEEKDAYS_EN[f.weekday];
    return `${hello(f.name, lang)} You asked for a routine pickup every ${day}, ${slotText(f.slot, lang)}. Shall we start this ${day}? We'll message you the day before each pickup. Just reply here to confirm.`;
  }
  const day = WEEKDAYS_BN[f.weekday];
  return `${hello(f.name, lang)} আপনি প্রতি ${day} ${slotText(f.slot, lang)} নিয়মিত পিকআপ চেয়েছেন। এই ${day} থেকে শুরু করব? প্রতি পিকআপের আগের দিন আমরা মেসেজ করব। কনফার্ম করতে এই মেসেজের উত্তর দিন।`;
}

/** A "Get a call back" request: reach out once to finish the booking. */
export function callbackMessage(f: { name: string | null }, lang: Lang) {
  if (lang === "en") {
    return `${hello(f.name, lang)} You asked us to call you about a pickup. When would suit you, and what should we collect? Just reply here and we'll book it for you. Thank you!`;
  }
  return `${hello(f.name, lang)} আপনি একটি পিকআপের জন্য আমাদের কল করতে বলেছিলেন। কখন সুবিধা হবে আর কী কী নিতে হবে, এই মেসেজের উত্তরে জানালে আমরাই বুক করে দেব। ধন্যবাদ!`;
}

/** After collection. */
export function pickedMessage(f: { name: string | null; orderNumber: string | null }, lang: Lang) {
  if (lang === "en") {
    const order = f.orderNumber ? ` Your order number is ${f.orderNumber}.` : "";
    return `${hello(f.name, lang)} We've collected your laundry.${order} We'll let you know when it's ready. Thank you!`;
  }
  const order = f.orderNumber ? ` আপনার অর্ডার নম্বর ${f.orderNumber}।` : "";
  return `${hello(f.name, lang)} আপনার কাপড় আমরা বুঝে নিয়েছি।${order} রেডি হলে জানিয়ে দেব। ধন্যবাদ!`;
}

/** Ready, with the delivery day and time of day when it is planned. */
export function readyMessage(f: { name: string | null; orderNumber: string; date: string | null; slot: SlotId | null }, lang: Lang) {
  if (lang === "en") {
    const when = f.date && f.slot ? ` We'll deliver it on ${dayText(f.date, lang)}, ${slotText(f.slot, lang)}.` : " When would you like it delivered? Just reply here.";
    return `${hello(f.name, lang)} Your order ${f.orderNumber} is ready.${when} Thank you!`;
  }
  const when = f.date && f.slot ? ` ডেলিভারি: ${dayText(f.date, lang)}, ${slotText(f.slot, lang)}।` : " কখন ডেলিভারি নিতে চান, এই মেসেজের উত্তরে জানাবেন।";
  return `${hello(f.name, lang)} আপনার অর্ডার ${f.orderNumber} রেডি হয়েছে।${when} ধন্যবাদ!`;
}

/**
 * The customer's history before this request: orders on the phone, minus the ones made from the
 * day before the request on (those are this request's own order). For "New to Velto" vs "Returning".
 */
export function priorOrders(job: DispatchJob, ctx: CustomerContext | null | undefined): { count: number; last: string | null } {
  if (!ctx) return { count: 0, last: null };
  const from = Date.parse(job.created_at) - 86_400_000;
  const since = ctx.recent.filter((o) => Date.parse(o.createdAt) >= from).length;
  const last = ctx.recent.find((o) => Date.parse(o.createdAt) < from)?.orderNumber ?? null;
  return { count: Math.max(0, ctx.orders - since), last };
}

/**
 * Open pickups from the same phone: the one each later request should be merged into (the
 * oldest open one), keyed by the later request's id.
 */
export function duplicateOf(jobs: DispatchJob[]): Map<string, DispatchJob> {
  const open = jobs.filter((j) => j.kind === "pickup" && j.phone_key && ["new", "confirmed", "assigned", "scheduled"].includes(j.stage));
  const first = new Map<string, DispatchJob>();
  for (const j of [...open].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (!first.has(j.phone_key!)) first.set(j.phone_key!, j);
  const out = new Map<string, DispatchJob>();
  for (const j of open) {
    const keep = first.get(j.phone_key!)!;
    if (keep.id !== j.id) out.set(j.id, keep);
  }
  return out;
}

/** "wash-and-iron" → "Wash and iron". */
const serviceWords = (slug: string | undefined) => {
  const t = (slug ?? "").trim().replace(/-/g, " ").slice(0, 30);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

/** The push staff get for a new website request: short enough for a lock screen. */
export function newRequestPush(kind: "booking" | "quote", f: { name: string; area: string; when?: string; service?: string }, siteUrl: string) {
  const bits = [f.name.trim().slice(0, 40), f.area.trim().slice(0, 40), (f.when ?? "").trim().slice(0, 40), serviceWords(f.service)].filter(Boolean);
  return {
    title: kind === "booking" ? "🧺 New pickup booking" : "📐 New quote request",
    body: `${bits.join(" · ")}. Call within 30 min.`,
    url: `${siteUrl.replace(/\/+$/, "")}/admin/requests?stage=new`,
  };
}
