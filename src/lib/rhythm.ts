/**
 * Velto Rhythm (docs/technical/RHYTHM.md): reminder settings and message text. Pure and
 * runtime-neutral, so the admin page, the daily run and the unit tests share it
 * (tests/command-center/rhythm.test.cjs). Who is reminded, and how often, is decided in the
 * database (docs/technical/sql/website_rhythm.sql), never here.
 */

export type RhythmLang = "bn" | "en";

/** A reminder sent by SMS (or by push when the customer allowed it). */
export type SmsPlaybook = {
  enabled: boolean;
  /** Most reminders one evening run sends for this playbook. */
  maxPerRun: number;
  lang: RhythmLang;
  textBn: string;
  textEn: string;
  /**
   * First-timer only: the text for customers whose first order was dry cleaning only. Dry cleaning
   * is an occasion purchase, so they're invited to the everyday habit (docs/technical/SECOND-SERVICE.md).
   */
  dcTextBn?: string;
  dcTextEn?: string;
};

/** The SMS playbooks, in the order the evening run works through them. */
export const SMS_PLAYBOOKS = ["regularDue", "onetimer", "seasonal"] as const;
export type SmsPlaybookKey = (typeof SMS_PLAYBOOKS)[number];
/** The database's name for each (website_rhythm_candidates). */
export const PLAYBOOK_ID: Record<SmsPlaybookKey, "regular_due" | "onetimer" | "seasonal"> = { regularDue: "regular_due", onetimer: "onetimer", seasonal: "seasonal" };

export type RhythmSettings = Record<SmsPlaybookKey, SmsPlaybook> & {
  slipping: {
    enabled: boolean;
    /** Most staff call tasks one morning run makes. */
    maxPerDay: number;
  };
  updatedAt: string;
};

/** {hi} = "Nazmul, " (or nothing), {service} = "আয়রনের কাপড়" / "ironing", {link} = the one-tap link. */
export const DEFAULT_TEXT_BN = "Velto: {hi}{service} জমেছে? পিকআপ এক ট্যাপে: {link}";
export const DEFAULT_TEXT_EN = "Velto: {hi}time for your {service} pickup? Book in one tap: {link}";
export const DEFAULT_TEXTS: Record<SmsPlaybookKey, { bn: string; en: string; max: number }> = {
  regularDue: { bn: DEFAULT_TEXT_BN, en: DEFAULT_TEXT_EN, max: 40 },
  onetimer: {
    bn: "Velto: {hi}প্রথম অর্ডারটা কেমন লাগল? আবার লাগলে পিকআপ এক ট্যাপে: {link}",
    en: "Velto: {hi}how was your first order? When you're ready again, book in one tap: {link}",
    max: 40,
  },
  seasonal: {
    bn: "Velto: {hi}শীতের কম্বল, লেপ, জ্যাকেট পরিষ্কারের সময়। পিকআপ এক ট্যাপে: {link}",
    en: "Velto: {hi}winter's coming. Blankets, comforters and jackets cleaned and ready. Book in one tap: {link}",
    max: 60,
  },
};

/** First-timers whose first order was dry cleaning only: invite them to the everyday habit. */
export const DEFAULT_ONETIMER_DC = {
  bn: "Velto: {hi}ড্রাই ক্লিনিং কেমন লাগল? প্রতিদিনের শার্ট-প্যান্টও আয়রন করি। পিকআপ এক ট্যাপে: {link}",
  en: "Velto: {hi}how was your dry cleaning? We iron your everyday shirts and pants too. Book a pickup in one tap: {link}",
};

const smsDefault = (k: SmsPlaybookKey): SmsPlaybook => ({
  enabled: false,
  maxPerRun: DEFAULT_TEXTS[k].max,
  lang: "bn",
  textBn: DEFAULT_TEXTS[k].bn,
  textEn: DEFAULT_TEXTS[k].en,
  ...(k === "onetimer" ? { dcTextBn: DEFAULT_ONETIMER_DC.bn, dcTextEn: DEFAULT_ONETIMER_DC.en } : {}),
});

export const DEFAULT_RHYTHM: RhythmSettings = {
  regularDue: smsDefault("regularDue"),
  onetimer: smsDefault("onetimer"),
  seasonal: smsDefault("seasonal"),
  slipping: { enabled: false, maxPerDay: 8 },
  updatedAt: "",
};

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** A template is usable when it carries the link and stays within three SMS parts. */
export function templateProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "Write the message.";
  if (!t.includes("{link}")) return "The message must include {link}, the one-tap booking link.";
  if (smsParts(renderMessage(t, { firstName: "Nazmul", service: "Wash + Iron", link: SAMPLE_LINK }, "bn")).parts > 3) {
    return "The message is too long: keep it to 3 SMS parts or fewer.";
  }
  return null;
}

export function parseRhythm(v: unknown): RhythmSettings {
  const r = rec(v);
  const s = rec(r.slipping);
  const text = (x: unknown, fallback: string) => (typeof x === "string" && !templateProblem(x) ? x.trim().slice(0, 400) : fallback);
  const sms = (k: SmsPlaybookKey): SmsPlaybook => {
    const d = rec(r[k]);
    return {
      enabled: d.enabled === true,
      maxPerRun: int(d.maxPerRun, 1, 150, DEFAULT_TEXTS[k].max),
      lang: d.lang === "en" ? "en" : "bn",
      textBn: text(d.textBn, DEFAULT_TEXTS[k].bn),
      textEn: text(d.textEn, DEFAULT_TEXTS[k].en),
      ...(k === "onetimer" ? { dcTextBn: text(d.dcTextBn, DEFAULT_ONETIMER_DC.bn), dcTextEn: text(d.dcTextEn, DEFAULT_ONETIMER_DC.en) } : {}),
    };
  };
  return {
    regularDue: sms("regularDue"),
    onetimer: sms("onetimer"),
    seasonal: sms("seasonal"),
    slipping: {
      enabled: s.enabled === true,
      maxPerDay: int(s.maxPerDay, 1, 40, DEFAULT_RHYTHM.slipping.maxPerDay),
    },
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : "",
  };
}

/** The template for one customer: first-timers who only had dry cleaning get the everyday invite. */
export function templateFor(key: SmsPlaybookKey, p: SmsPlaybook, usualService: string | null | undefined, lang: RhythmLang): string {
  const dcOnly = key === "onetimer" && usualService?.trim() === "Dry Cleaning";
  if (dcOnly) {
    const dc = lang === "bn" ? p.dcTextBn : p.dcTextEn;
    if (dc) return dc;
  }
  return lang === "bn" ? p.textBn : p.textEn;
}

const SERVICE_WORDS: Record<string, Record<RhythmLang, string>> = {
  Ironing: { bn: "আয়রনের কাপড়", en: "ironing" },
  "Wash + Iron": { bn: "ধোয়ার কাপড়", en: "wash & iron" },
  "Dry Cleaning": { bn: "ড্রাই ক্লিনিংয়ের কাপড়", en: "dry cleaning" },
};

/** The customer's usual service as the message says it. */
export const serviceWords = (service: string | null | undefined, lang: RhythmLang) =>
  SERVICE_WORDS[service?.trim() ?? ""]?.[lang] ?? (lang === "bn" ? "লন্ড্রির কাপড়" : "laundry");

export const SAMPLE_LINK = "www.velto.com.bd/bn/r/Ab3xK9pQ";

/** The link as it appears in the SMS: no https://, the page language, the 8-character code. */
export function rhythmLink(siteUrl: string, code: string, lang: RhythmLang) {
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `${host}${lang === "bn" ? "/bn" : ""}/r/${code}`;
}

/** The message for one customer. A missing first name drops the greeting cleanly. */
export function renderMessage(template: string, f: { firstName: string | null; service: string | null; link: string }, lang: RhythmLang) {
  const name = f.firstName?.trim().split(/\s+/)[0]?.slice(0, 20) ?? "";
  const hi = lang === "bn" ? (name ? `${name}, ` : "") : name ? `Hi ${name}, ` : "Hi, ";
  return template
    .replaceAll("{hi}", hi)
    .replaceAll("{service}", serviceWords(f.service, lang))
    .replaceAll("{link}", f.link)
    .replace(/\s+/g, " ")
    .trim();
}

// GSM 03.38 basic set (plus the extension characters, which count double).
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

/** How many SMS parts a message costs: 160/153 characters in plain text, 70/67 with Bangla. */
export function smsParts(text: string): { unicode: boolean; length: number; parts: number } {
  const chars = [...text];
  const unicode = chars.some((c) => !GSM.includes(c) && !GSM_EXT.includes(c));
  const length = unicode ? chars.reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0) : chars.reduce((n, c) => n + (GSM_EXT.includes(c) ? 2 : 1), 0);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return { unicode, length, parts: length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi) };
}

/** Evening SMS only go out between 10:00 and 20:00 Dhaka, whatever calls the run. */
export function smsHourOk(now = new Date()) {
  const h = (now.getUTCHours() + 6) % 24;
  return h >= 10 && h < 20;
}
