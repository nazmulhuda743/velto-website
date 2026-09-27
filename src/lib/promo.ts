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
    image: /^https:\/\/[^\s"'<>]+$/.test(str(p.image, 500)) ? str(p.image, 500) : "",
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
    href: promoHrefOk(str(p.href, 300)) ? str(p.href, 300) : "",
    frequency: POPUP_FREQUENCIES.includes(p.frequency as PopupFrequency) ? (p.frequency as PopupFrequency) : "day",
    delaySeconds: Number.isInteger(delay) && delay >= 0 && delay <= 60 ? delay : 3,
    startsOn: DATE.test(str(p.startsOn, 10)) ? str(p.startsOn, 10) : "",
    endsOn: DATE.test(str(p.endsOn, 10)) ? str(p.endsOn, 10) : "",
    updatedAt: str(p.updatedAt, 40),
  };
}

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
 * inside their account, and the legal pages should read undisturbed.
 */
export function popupExcluded(pathname: string): boolean {
  const path = pathname.replace(/^\/(?:en|bn)(?=\/|$)/, "") || "/";
  return /^\/(?:book|quote|track|account|auth|login|signup|forgot-password|reset-password|offline|privacy|cookies|terms|admin)(?:\/|$)/.test(path);
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
  let hash = 5381;
  for (const ch of parts.join("\u0001")) hash = ((hash << 5) + hash + ch.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}
