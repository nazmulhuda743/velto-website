/**
 * Monthly goal → next-month reward ("spend ৳X this month, get Y all next month"). Pure and
 * runtime-neutral: the admin's ladder (website_content.loyalty.goal) and the customer's spend
 * this month (portal_goal) come in; the rung reached, the next one and the progress come out.
 * Tested in tests/customer-goal.test.cjs. The coupons themselves are issued by
 * website_goal_settle (docs/technical/sql/website_monthly_goal.sql) once the month is over.
 *
 * Why it works (Kohl's Cash, Starbucks Stars): a visible target people speed up towards, a head
 * start (the first order counts twice), and a reward that is only good next month, so it brings
 * them back. The amounts are the owner's; the defaults below are only a proposal from Velto's
 * own order data (Gold customers average ~৳475 a month).
 */

export type GoalKind = "delivery" | "taka";

export type GoalRung = {
  /** Whole taka spent in the month (cancelled orders excluded) to reach this rung. */
  spend: number;
  /** 'delivery': free pickup & delivery on every order next month. 'taka': an amount off one order. */
  kind: GoalKind;
  /** Whole taka off, for 'taka' rungs. */
  amount: number;
  /** The reward as the customer reads it. */
  label: string;
  labelBn: string;
};

export type GoalSettings = {
  enabled: boolean;
  /** The first order of the month counts twice towards the goal (a head start). */
  doubleFirst: boolean;
  /** Ascending by spend, up to four. */
  rungs: GoalRung[];
  updatedAt?: string;
};

export const DEFAULT_GOAL: GoalSettings = {
  enabled: false,
  doubleFirst: true,
  rungs: [
    { spend: 800, kind: "delivery", amount: 0, label: "Free pickup & delivery on every order next month", labelBn: "পরের মাসে প্রতিটি অর্ডারে ফ্রি পিকআপ ও ডেলিভারি" },
    { spend: 1500, kind: "taka", amount: 200, label: "৳200 off an order next month", labelBn: "পরের মাসে একটি অর্ডারে ৳২০০ ছাড়" },
    { spend: 2500, kind: "taka", amount: 400, label: "৳400 off an order next month", labelBn: "পরের মাসে একটি অর্ডারে ৳৪০০ ছাড়" },
  ],
};

export const MAX_RUNGS = 4;

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};

/** Stored settings over the defaults. A broken ladder falls back to the default ladder as a whole. */
export function parseGoal(v: unknown): GoalSettings {
  const s = rec(v);
  const raw = Array.isArray(s.rungs) ? s.rungs.slice(0, MAX_RUNGS) : [];
  const rungs: GoalRung[] = raw.map((r) => {
    const x = rec(r);
    return {
      spend: int(x.spend, 100, 100_000, 0),
      kind: x.kind === "delivery" ? "delivery" : "taka",
      amount: int(x.amount, 0, 100_000, 0),
      label: str(x.label, 120),
      labelBn: str(x.labelBn, 120),
    };
  });
  return {
    enabled: s.enabled === true,
    doubleFirst: s.doubleFirst !== false,
    rungs: rungs.length && !goalProblem({ enabled: true, doubleFirst: true, rungs }) ? rungs : DEFAULT_GOAL.rungs,
    ...(str(s.updatedAt, 40) ? { updatedAt: str(s.updatedAt, 40) } : {}),
  };
}

/** Why the ladder from the admin form can't be saved; null when it can. */
export function goalProblem(s: GoalSettings): string | null {
  if (!s.rungs.length) return "Add at least one rung.";
  if (s.rungs.length > MAX_RUNGS) return `Keep to ${MAX_RUNGS} rungs.`;
  for (let i = 0; i < s.rungs.length; i++) {
    const r = s.rungs[i];
    if (!(r.spend >= 100)) return `Rung ${i + 1} needs a spend of at least ৳100.`;
    if (i > 0 && !(r.spend > s.rungs[i - 1].spend)) return `Rung ${i + 1} must need more spend than rung ${i}.`;
    if (r.kind === "taka" && !(r.amount > 0)) return `Rung ${i + 1}: an amount off needs a number of taka.`;
    if (r.kind === "taka" && r.amount >= r.spend) return `Rung ${i + 1}: the amount off can't be as much as the spend that earns it.`;
    if (!r.label) return `Rung ${i + 1} needs the reward written out, as the customer will read it.`;
  }
  return null;
}

/** Today in Dhaka as YYYY-MM-DD (the goal month runs on Dhaka days). */
export function todayDhaka(now = Date.now()): string {
  return new Date(now + 6 * 3_600_000).toISOString().slice(0, 10);
}

/** "2026-09" for a date; the months either side; "September" for a month. */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7);
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
export const monthName = (month: string, lang: "en" | "bn" = "en") => (lang === "bn" ? MONTHS_BN : MONTHS)[Number(month.slice(5, 7)) - 1] ?? month;
/** Days in the month, and how many are left counting today. */
export function daysLeft(isoToday: string): { inMonth: number; left: number } {
  const [y, m, d] = isoToday.split("-").map(Number);
  const inMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { inMonth, left: inMonth - d + 1 };
}

export type GoalStatus = {
  /** The highest rung reached so far this month, or null. */
  reached: GoalRung | null;
  /** The next rung, or null at the top. */
  next: GoalRung | null;
  /** Whole taka still to spend for the next rung (0 at the top). */
  toNext: number;
  /** 0–1 from the previous rung (or zero) to the next one. */
  progress: number;
};

export function goalStatus(s: GoalSettings, spendTaka: number): GoalStatus {
  const spend = Math.max(0, spendTaka);
  let idx = -1;
  s.rungs.forEach((r, i) => {
    if (spend >= r.spend) idx = i;
  });
  const reached = idx >= 0 ? s.rungs[idx] : null;
  const next = s.rungs[idx + 1] ?? null;
  const from = reached?.spend ?? 0;
  const toNext = next ? Math.max(0, next.spend - spend) : 0;
  const progress = next ? Math.min(1, Math.max(0, (spend - from) / (next.spend - from))) : 1;
  return { reached, next, toNext, progress };
}

/** A coupon as portal_goal / website_goal_coupons return it. */
export type GoalCoupon = {
  id: string;
  code: string;
  kind: GoalKind;
  amount: number;
  label: string;
  labelBn: string;
  month: string;
  validFrom: string;
  validTo: string;
  status: "open" | "used" | "void" | "expired";
};

const isCoupon = (v: unknown): v is GoalCoupon => {
  const c = rec(v);
  return typeof c.id === "string" && /^VG-[A-Z0-9]{6}$/.test(String(c.code)) && (c.kind === "delivery" || c.kind === "taka") && /^\d{4}-\d{2}-\d{2}$/.test(String(c.validTo));
};

export function parseCoupons(v: unknown): GoalCoupon[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isCoupon).map((c) => ({
    id: c.id,
    code: c.code,
    kind: c.kind,
    amount: int(c.amount, 0, 100_000, 0),
    label: str(c.label, 120),
    labelBn: str(c.labelBn, 120),
    month: str(c.month, 7),
    validFrom: str(c.validFrom, 10),
    validTo: str(c.validTo, 10),
    status: c.status === "used" || c.status === "void" || c.status === "expired" ? c.status : "open",
  }));
}

/** The coupon a booking can carry today: open and still valid (a 'taka' one is single-use, a 'delivery' one lasts the month). */
export function usableCoupon(coupons: GoalCoupon[], isoToday: string): GoalCoupon | null {
  return coupons.find((c) => c.status === "open" && c.validFrom <= isoToday && c.validTo >= isoToday) ?? null;
}

/** One line for the Ops notes, in English for staff: "Coupon VG-A1B2C3: ৳200 off (valid to 2026-10-31)". */
export function couponNote(c: GoalCoupon): string {
  const what = c.kind === "delivery" ? "free pickup & delivery this month" : `৳${c.amount} off`;
  return `Coupon ${c.code}: ${what} (valid to ${c.validTo})`;
}
