/**
 * Order feedback and saved preferences: the shapes, the rules the database also enforces
 * (docs/technical/sql/website_customer_extras.sql) and the booking note built from them.
 * Pure and runtime-neutral; tested in tests/customer-loyalty.test.cjs.
 */

export const FEEDBACK_ISSUES = ["missing_item", "damage", "stain", "ironing", "smell", "late", "service", "other"] as const;
export type FeedbackIssue = (typeof FEEDBACK_ISSUES)[number];

export type Feedback = {
  orderNumber: string;
  rating: number;
  issues: FeedbackIssue[];
  comment: string | null;
  createdAt: string;
  editable: boolean;
};

/** Days after delivery during which the account asks for a rating. */
export const FEEDBACK_ASK_DAYS = 14;

/** Ratings of 4–5 are invited to say so on Google; 1–3 go to the team instead. */
export const happy = (rating: number) => rating >= 4;

export function cleanIssues(values: unknown[]): FeedbackIssue[] {
  const set = new Set(values.filter((v): v is FeedbackIssue => FEEDBACK_ISSUES.includes(v as FeedbackIssue)));
  return FEEDBACK_ISSUES.filter((i) => set.has(i));
}

/**
 * The delivered order to ask about on the account home: the most recent one delivered within
 * the last FEEDBACK_ASK_DAYS days that has no rating yet.
 */
export function orderToRate<T extends { orderNumber: string; status: string; deliveredAt: string | null; orderDate: string }>(
  orders: T[],
  rated: Set<string>,
  now: Date = new Date(),
): T | null {
  const limit = now.getTime() - FEEDBACK_ASK_DAYS * 86_400_000;
  const candidates = orders
    .filter((o) => o.status === "Delivered" && !rated.has(o.orderNumber))
    .filter((o) => Date.parse(o.deliveredAt ?? o.orderDate) >= limit)
    .sort((a, b) => Date.parse(b.deliveredAt ?? b.orderDate) - Date.parse(a.deliveredAt ?? a.orderDate));
  return candidates[0] ?? null;
}

/* ---------- preferences ---------- */

export type Care = {
  shirts?: "hanger" | "folded";
  starch?: "none" | "light" | "regular";
  fragrance?: "none" | "regular";
  separate?: boolean;
  note?: string;
};

export type SavedAddress = { label: string; address: string; area: string };

export type Preferences = { care: Care; addresses: SavedAddress[] };

export const EMPTY_PREFERENCES: Preferences = { care: {}, addresses: [] };

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);

export const AREA = /^([1-9]|1[0-8]|outside)$/;

/** Same rules as portal_prefs_save: unknown keys and values are dropped. */
export function parsePreferences(v: unknown): Preferences {
  const p = rec(v);
  const c = rec(p.care);
  const note = typeof c.note === "string" ? c.note.trim().slice(0, 300) : "";
  const care: Care = {
    shirts: pick(c.shirts, ["hanger", "folded"] as const),
    starch: pick(c.starch, ["none", "light", "regular"] as const),
    fragrance: pick(c.fragrance, ["none", "regular"] as const),
    separate: c.separate === true || c.separate === "true" || undefined,
    note: note || undefined,
  };
  for (const k of Object.keys(care) as (keyof Care)[]) if (care[k] === undefined) delete care[k];
  const addresses = (Array.isArray(p.addresses) ? p.addresses : [])
    .map((a) => {
      const r = rec(a);
      const address = typeof r.address === "string" ? r.address.trim().slice(0, 300) : "";
      const area = typeof r.area === "string" && AREA.test(r.area.trim()) ? r.area.trim() : "";
      return { label: typeof r.label === "string" ? r.label.trim().slice(0, 30) : "", address, area };
    })
    .filter((a) => a.address)
    .slice(0, 3);
  return { care, addresses };
}

export type CareWords = {
  intro: string;
  shirts: Record<"hanger" | "folded", string>;
  starch: Record<"none" | "light" | "regular", string>;
  fragrance: Record<"none" | "regular", string>;
  separate: string;
};

/** "My usual care: shirts on hangers; no starch; …" for the booking note, or "" when nothing is set. */
export function careNote(care: Care, w: CareWords): string {
  const parts = [
    care.shirts ? w.shirts[care.shirts] : null,
    care.starch ? w.starch[care.starch] : null,
    care.fragrance ? w.fragrance[care.fragrance] : null,
    care.separate ? w.separate : null,
    care.note ?? null,
  ].filter((p): p is string => Boolean(p));
  return parts.length ? `${w.intro} ${parts.join("; ")}.`.replace(/\.\.$/, ".") : "";
}

/** The booking note: the page's own note (repeat, routine, service) first, then the care line. */
export const joinNotes = (...notes: (string | null | undefined)[]) =>
  notes
    .map((n) => n?.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 1000);
