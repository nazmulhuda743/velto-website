/**
 * Promotions: the moving top bar and the campaign popup, both edited on Promo & popup in the
 * admin. Pure and runtime-neutral (server, browser and the unit tests share it):
 * tests/command-center/promo.test.cjs.
 */

export const POPUP_FREQUENCIES = ["session", "day", "week", "once"] as const;
export type PopupFrequency = (typeof POPUP_FREQUENCIES)[number];

export const FREQUENCY_INFO: Record<PopupFrequency, string> = {
  session: "Once per visit (shows again when the browser is reopened)",
  day: "Once a day",
  week: "Once a week",
  once: "Once only, until the campaign is edited",
};

export type PromoPopup = {
  enabled: boolean;
  /** Changes whenever the campaign content changes, so everyone sees the new campaign once more. */
  version: string;
  image: string;
  /** poster: shown whole, the whole picture opens the link. photo: fills a side panel, cropped. */
  imageStyle: "poster" | "photo";
  imageAlt: string;
  imageAltBn: string;
  tag: string;
  tagBn: string;
  title: string;
  titleBn: string;
  body: string;
  bodyBn: string;
  cta: string;
  ctaBn: string;
  /** The offer in big type at the top, e.g. "10% OFF": the first word is the headline number. */
  offer: string;
  offerBn: string;
  /** Up to three short reasons to act now, separated by "|", shown with ticks. */
  points: string;
  pointsBn: string;
  /** Small print under the button: who qualifies and how the discount is applied. */
  fine: string;
  fineBn: string;
  /** Show the Google rating (from Site settings) as proof under the button. */
  proof: boolean;
  href: string;
  frequency: PopupFrequency;
  delaySeconds: number;
  /** Dhaka dates, YYYY-MM-DD; empty means no limit. */
  startsOn: string;
  endsOn: string;
  updatedAt: string;
};

export const EMPTY_POPUP: PromoPopup = {
  enabled: false,
  version: "",
  image: "",
  imageStyle: "poster",
  imageAlt: "",
  imageAltBn: "",
  tag: "",
  tagBn: "",
  title: "",
  titleBn: "",
  body: "",
  bodyBn: "",
  cta: "",
  ctaBn: "",
  offer: "",
  offerBn: "",
  points: "",
  pointsBn: "",
  fine: "",
  fineBn: "",
  proof: false,
  href: "",
  frequency: "day",
  delaySeconds: 3,
  startsOn: "",
  endsOn: "",
  updatedAt: "",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function parsePopup(v: unknown): PromoPopup {
  const p = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const delay = Number(p.delaySeconds);
  return {
    enabled: p.enabled === true,
    version: str(p.version, 20),
    image: promoImageOk(str(p.image, 500)) ? str(p.image, 500) : "",
    imageStyle: p.imageStyle === "photo" ? "photo" : "poster",
    imageAlt: str(p.imageAlt, 300),
    imageAltBn: str(p.imageAltBn, 300),
    tag: str(p.tag, 40),
    tagBn: str(p.tagBn, 40),
    title: str(p.title, 120),
    titleBn: str(p.titleBn, 120),
    body: str(p.body, 400),
    bodyBn: str(p.bodyBn, 400),
    cta: str(p.cta, 40),
    ctaBn: str(p.ctaBn, 40),
    offer: str(p.offer, 24),
    offerBn: str(p.offerBn, 24),
    points: str(p.points, 240),
    pointsBn: str(p.pointsBn, 240),
    fine: str(p.fine, 200),
    fineBn: str(p.fineBn, 200),
    proof: p.proof === true,
    href: promoHrefOk(str(p.href, 300)) ? str(p.href, 300) : "",
    frequency: POPUP_FREQUENCIES.includes(p.frequency as PopupFrequency) ? (p.frequency as PopupFrequency) : "day",
    delaySeconds: Number.isInteger(delay) && delay >= 0 && delay <= 60 ? delay : 3,
    startsOn: DATE.test(str(p.startsOn, 10)) ? str(p.startsOn, 10) : "",
    endsOn: DATE.test(str(p.endsOn, 10)) ? str(p.endsOn, 10) : "",
    updatedAt: str(p.updatedAt, 40),
  };
}

/** An uploaded picture (https) or one of the website's own photos under /images. */
export const promoImageOk = (src: string) => /^https:\/\/[^\s"'<>]+$/.test(src) || (/^\/images\/[A-Za-z0-9/_.-]+\.(?:jpg|jpeg|png|webp|avif)$/.test(src) && !src.includes(".."));

/** A page on this website ("/signup", "/book?source=x") or a full https:// link. */
export const promoHrefOk = (href: string) => href === "" || /^\/(?!\/)[^\s"'<>]*$/.test(href) || /^https:\/\/[^\s"'<>]+$/.test(href);

/** Why a popup cannot be switched on as it stands; null when it is complete. */
export function popupProblem(p: PromoPopup): string | null {
  if (!p.image && !p.title) return "Add a poster image or a headline: the popup needs something to show.";
  if (!p.href) return "Add the link the popup opens (for example /signup or /book).";
  if (!promoHrefOk(p.href)) return "The link must be a page like /signup or a full https:// address.";
  if (p.image && !p.imageAlt && !p.title) return "Describe the poster in the alt text (what it says), for screen readers and when the image can't load.";
  if (p.startsOn && p.endsOn && p.startsOn > p.endsOn) return "The end date is before the start date.";
  return null;
}

/** Dhaka midnight at the start of `date`, or the end of it, as a timestamp. */
export function dhakaDay(date: string, edge: "start" | "end"): number {
  return Date.parse(`${date}T${edge === "start" ? "00:00:00" : "23:59:59.999"}+06:00`);
}

/** Whether the campaign is switched on, complete and inside its dates right now. */
export function popupActive(p: PromoPopup, now = Date.now()): boolean {
  if (!p.enabled || popupProblem(p)) return false;
  if (p.startsOn && now < dhakaDay(p.startsOn, "start")) return false;
  if (p.endsOn && now > dhakaDay(p.endsOn, "end")) return false;
  return true;
}

/** "Starts 12 Oct", "Ends 30 Oct", "Ended", "Live" for the admin. */
export function popupSchedule(p: PromoPopup, now = Date.now()): "scheduled" | "live" | "ended" | "always" {
  if (p.startsOn && now < dhakaDay(p.startsOn, "start")) return "scheduled";
  if (p.endsOn && now > dhakaDay(p.endsOn, "end")) return "ended";
  return p.startsOn || p.endsOn ? "live" : "always";
}

export type SeenRecord = { version: string; at: number };

const DAY = 24 * 60 * 60 * 1000;

/**
 * Whether to show the popup to a visitor who last closed version `seen.version` at `seen.at`.
 * A new version always shows; "session" frequency is kept in tab storage by the caller, so
 * a stored record there always means "already shown this visit".
 */
export function popupDue(p: Pick<PromoPopup, "version" | "frequency">, seen: SeenRecord | null, now = Date.now()): boolean {
  if (!seen || seen.version !== p.version) return true;
  if (p.frequency === "once" || p.frequency === "session") return false;
  const gap = p.frequency === "day" ? DAY : 7 * DAY;
  return now - seen.at >= gap;
}

/**
 * Pages where the popup never opens: the customer is already signing up, booking, tracking or
 * inside their account (or on a one-tap reminder page, /r), and the legal pages should read undisturbed.
 */
export function popupExcluded(pathname: string): boolean {
  const path = pathname.replace(/^\/(?:en|bn)(?=\/|$)/, "") || "/";
  return /^\/(?:book|quote|track|account|auth|login|signup|forgot-password|reset-password|offline|privacy|cookies|terms|admin|r|i)(?:\/|$)/.test(path);
}

/**
 * Where the top bar goes: the link set in the admin; failing that, the booking page whenever the
 * bar carries an offer that the booking summary repeats (an offer people can't act on is bait).
 */
export function barLink(a: { href: string; bookingNote: string }): string {
  if (a.href) return a.href;
  return a.bookingNote.trim() ? SIGN_IN_THEN_BOOK("promo_bar") : "";
}

/** The top-bar text may hold several messages separated by "|"; each becomes one ticker item. */
export function barMessages(text: string): string[] {
  return text
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Seconds for one full pass of the ticker: about 12 characters a second, never so quick that a
 * short message flickers past, never so slow that a long one crawls.
 */
export function tickerSeconds(messages: string[], copies: number): number {
  const chars = messages.reduce((n, m) => n + m.length + 6, 0) * copies;
  return Math.min(90, Math.max(18, Math.round(chars / 12)));
}

/** How many times the message group must repeat so the track is wider than any screen. */
export function tickerCopies(messages: string[]): number {
  const chars = messages.reduce((n, m) => n + m.length + 6, 0);
  // ~9px a character on the small type; the widest common screen is ~1920px.
  return Math.min(12, Math.max(2, Math.ceil(2200 / Math.max(1, chars * 9))));
}

/** A short version string that changes when any visible field changes. */
export function popupFingerprint(p: PromoPopup): string {
  const parts = [p.image, p.tag, p.tagBn, p.title, p.titleBn, p.body, p.bodyBn, p.cta, p.ctaBn, p.href];
  // Newer fields join only when set, so campaigns saved before they existed keep their version.
  for (const extra of [p.offer, p.offerBn, p.points, p.pointsBn, p.fine, p.fineBn]) if (extra) parts.push(extra);
  if (p.imageStyle === "photo") parts.push("photo");
  let hash = 5381;
  for (const ch of parts.join("\u0001")) hash = ((hash << 5) + hash + ch.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/** "10% OFF" → { big: "10%", small: "OFF" }: the first word is set large, the rest beside it. */
export function offerParts(offer: string): { big: string; small: string } {
  const m = offer.trim().match(/^(\S+)\s*(.*)$/);
  return m ? { big: m[1], small: m[2] } : { big: "", small: "" };
}

/** The ticked points, at most three. */
export const popupPoints = (points: string) => barMessages(points).slice(0, 3);

/** Offers lead to sign-in first, then /book (customers are trained to book signed in; guests can skip). */
export const SIGN_IN_THEN_BOOK = (source: string) => `/login?next=${encodeURIComponent(`/book?source=${source}`)}`;

/**
 * Starting point for the first-order 10% campaign (lib/first-order-offer.ts) (Promo & popup → Use the
 * template). Only facts already published on the site; the discount terms are Velto's own offer.
 * The button opens sign-in first, then the booking page. Loading it never switches the popup on.
 */
export const FIRST_ORDER_TEMPLATE = {
  image: "/images/pages/finished-shirts-rail.webp",
  imageStyle: "photo" as const,
  imageAlt: "Freshly finished shirts on wooden hangers at Velto",
  imageAltBn: "Velto-তে কাঠের হ্যাঙ্গারে সদ্য ফিনিশ করা শার্ট",
  tag: "First order offer",
  tagBn: "প্রথম অর্ডার অফার",
  offer: "10% off first order",
  offerBn: "প্রথম অর্ডারে ১০% ছাড়",
  title: "Your first order on our website: 10% off.",
  titleBn: "ওয়েবসাইটে আপনার প্রথম অর্ডারে ১০% ছাড়।",
  body: "Sign in with your mobile, then book your first pickup in a few taps. We collect from your door, and your first website order costs 10% less, whatever the amount.",
  bodyBn: "মোবাইল দিয়ে সাইন ইন করুন, তারপর কয়েক ট্যাপে আপনার প্রথম পিকআপ বুক করুন। আমরা আপনার দরজা থেকে নিয়ে যাই, আর ওয়েবসাইটে প্রথম অর্ডারে যেকোনো পরিমাণে ১০% কম লাগে।",
  points: "Free pickup & delivery on ৳499+ | Every item tagged and checked | Pickup across Uttara Sectors 1–18",
  pointsBn: "৳৪৯৯+ অর্ডারে ফ্রি পিকআপ ও ডেলিভারি | প্রতিটি আইটেম ট্যাগ ও যাচাই করা হয় | উত্তরা সেক্টর ১–১৮ জুড়ে পিকআপ",
  cta: "Sign in & book · 10% off",
  ctaBn: "সাইন ইন করে বুক করুন · ১০% ছাড়",
  fine: "For your first order booked on the website, whatever the amount. We apply the 10% when we confirm your order.",
  fineBn: "ওয়েবসাইটে বুক করা প্রথম অর্ডারে প্রযোজ্য, যেকোনো পরিমাণে। অর্ডার কনফার্ম করার সময় আমরা ১০% ছাড় যোগ করি।",
  href: SIGN_IN_THEN_BOOK("promo_popup"),
  proof: true,
} satisfies Partial<PromoPopup>;
