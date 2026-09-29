/**
 * Abandoned booking recovery (phase 5), the parts that are pure and unit-tested:
 *
 * 1. The draft: an unsent booking kept in the visitor's own browser (localStorage) so they can
 *    "Continue your booking" later. It never leaves the device. No photos and no pickup window
 *    (a window may be gone by the time they come back); kept for 7 days.
 * 2. The call-back request: what the visitor chose to send with "Get a call back", checked before
 *    it reaches the database, and the managers' phone alert.
 */

export const DRAFT_KEY = "velto.booking.draft.v1";
export const DRAFT_MAX_AGE_MS = 7 * 86_400_000;

type Line = { id: string; item: string; service: string; quantity: number; options: string[]; prices: Record<string, number | null> };

export type BookingDraft = {
  v: 1;
  savedAt: number;
  service: string | null;
  services: string[];
  what: string;
  items: Line[];
  sector: string;
  address: string;
  backBy: string;
  name: string;
  phone: string;
  notes: string;
};

type DraftFields = Omit<BookingDraft, "v" | "savedAt">;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);

/** Worth keeping: the visitor has typed or chosen something of their own. */
export function draftHasContent(d: Pick<DraftFields, "what" | "items" | "name" | "phone" | "address" | "services">) {
  return Boolean(d.what.trim() || d.items.length || d.name.trim() || d.phone.trim() || d.address.trim() || d.services.length);
}

/** The draft to store for a form state, or null when there is nothing worth keeping. */
export function makeDraft(f: DraftFields, now = Date.now()): BookingDraft | null {
  const d: BookingDraft = {
    v: 1,
    savedAt: now,
    service: f.service,
    services: f.services.slice(0, 3),
    what: f.what.slice(0, 160),
    items: f.items.slice(0, 40).map((l) => ({ id: l.id, item: l.item, service: l.service, quantity: l.quantity, options: l.options, prices: l.prices })),
    sector: f.sector,
    address: f.address.slice(0, 500),
    backBy: f.backBy,
    name: f.name.slice(0, 100),
    phone: f.phone.slice(0, 32),
    notes: f.notes.slice(0, 1000),
  };
  return draftHasContent(d) ? d : null;
}

/** A stored draft read back defensively: anything malformed, too old or empty is ignored. */
export function readDraft(raw: string | null, now = Date.now()): BookingDraft | null {
  if (!raw) return null;
  let o: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    o = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.v !== 1 || typeof o.savedAt !== "number" || now - o.savedAt > DRAFT_MAX_AGE_MS || o.savedAt > now + 60_000) return null;
  const items = (Array.isArray(o.items) ? o.items : []).flatMap((x): Line[] => {
    const l = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
    if (!l || typeof l.item !== "string" || !l.item.trim() || !Number.isInteger(l.quantity) || (l.quantity as number) < 1 || (l.quantity as number) > 999) return [];
    const prices: Record<string, number | null> = {};
    if (l.prices && typeof l.prices === "object") {
      for (const [k, v] of Object.entries(l.prices as Record<string, unknown>)) if (v === null || (typeof v === "number" && Number.isFinite(v))) prices[k] = v as number | null;
    }
    return [{ id: str(l.id, 60) || `d${Math.random().toString(36).slice(2)}`, item: l.item.slice(0, 80), service: str(l.service, 40), quantity: l.quantity as number, options: strs(l.options, 6), prices }];
  });
  const d: BookingDraft = {
    v: 1,
    savedAt: o.savedAt,
    service: typeof o.service === "string" ? o.service.slice(0, 40) : null,
    services: strs(o.services, 3),
    what: str(o.what, 160),
    items: items.slice(0, 40),
    sector: str(o.sector, 10),
    address: str(o.address, 500),
    backBy: /^\d{4}-\d{2}-\d{2}$/.test(str(o.backBy, 10)) ? str(o.backBy, 10) : "",
    name: str(o.name, 100),
    phone: str(o.phone, 32),
    notes: str(o.notes, 1000),
  };
  return draftHasContent(d) ? d : null;
}

/* ---------- call-back request ---------- */

export type CallbackInput = { name: string; phone: string; area?: string; what?: string; services?: string; preferred?: string };

/** 01XXXXXXXXX from what the visitor typed (+880 / 880 / spaces allowed), or null. */
export function bdPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const local = /^8801\d{9}$/.test(digits) ? digits.slice(2) : /^008801\d{9}$/.test(digits) ? digits.slice(4) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

const oneLine = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || undefined : undefined;

/** What the endpoint accepts: a real name and a Bangladesh mobile; the rest optional, one line each. */
export function validateCallback(value: unknown): { ok: true; value: CallbackInput } | { ok: false; field: "request" | "name" | "phone" } {
  const o = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (!o) return { ok: false, field: "request" };
  const name = oneLine(o.name, 100);
  if (!name || name.length < 2) return { ok: false, field: "name" };
  const phone = typeof o.phone === "string" ? bdPhone(o.phone) : null;
  if (!phone) return { ok: false, field: "phone" };
  return {
    ok: true,
    value: { name, phone, area: oneLine(o.area, 120), what: oneLine(o.what, 300), services: oneLine(o.services, 120), preferred: oneLine(o.preferred, 120) },
  };
}

/** Managers' phone alert. */
export function callbackPush(c: Pick<CallbackInput, "name" | "area">, siteUrl: string) {
  const bits = [c.name.slice(0, 40), c.area?.slice(0, 40)].filter(Boolean);
  return {
    title: "📞 Call-back request",
    body: `${bits.join(" · ")}. Started a booking but asked us to call. Call within 30 min.`,
    url: `${siteUrl.replace(/\/+$/, "")}/admin/requests#callbacks`,
  };
}

export const CALLBACK_OUTCOMES = [
  { id: "booked", label: "Booked (I made the booking)" },
  { id: "will_book", label: "Will book themselves" },
  { id: "not_interested", label: "Not interested" },
  { id: "no_answer", label: "No answer" },
  { id: "wrong_number", label: "Wrong number" },
  { id: "spam", label: "Spam / test" },
] as const;
