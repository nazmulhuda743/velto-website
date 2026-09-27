/**
 * Loyalty tiers and milestone rewards for the customer account. Pure and runtime-neutral:
 * the website settings (admin → Loyalty) and the order counts (portal_loyalty) come in, the
 * customer's tier, progress and next milestone come out. Tested in tests/customer-loyalty.test.cjs.
 *
 * Tier names, thresholds and every perk or reward are the owner's decisions, set in the admin.
 * The defaults below are only the proposal from Velto's own order data (12 months to Sept 2026):
 * 1–3 / 4–7 / 8–15 / 16+ orders, with no perks and no reward until the owner writes them.
 */

import { DEFAULT_GOAL, parseGoal, type GoalSettings } from "./goal";

export type Tier = {
  name: string;
  nameBn: string;
  /** Orders in the window needed to reach this tier. The first tier's is always 1. */
  min: number;
  /** What the tier gets, as the customer should read it. Empty: nothing is promised. */
  perks: string;
  perksBn: string;
};

export type LoyaltySettings = {
  enabled: boolean;
  /** Orders are counted over this many months, so a tier reflects recent custom. */
  windowMonths: number;
  tiers: Tier[];
  /** Every Nth order (lifetime) earns the reward. 0 or an empty reward: no milestone shown. */
  milestone: { every: number; reward: string; rewardBn: string };
  /** Monthly goal → next-month reward (goal.ts); its own switch, saved from its own form. */
  goal: GoalSettings;
  updatedAt?: string;
};

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: false,
  windowMonths: 12,
  tiers: [
    { name: "Member", nameBn: "মেম্বার", min: 1, perks: "", perksBn: "" },
    { name: "Silver", nameBn: "সিলভার", min: 4, perks: "", perksBn: "" },
    { name: "Gold", nameBn: "গোল্ড", min: 8, perks: "", perksBn: "" },
    { name: "Platinum", nameBn: "প্লাটিনাম", min: 16, perks: "", perksBn: "" },
  ],
  milestone: { every: 5, reward: "", rewardBn: "" },
  goal: DEFAULT_GOAL,
};

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};

/** Stored settings over the defaults. Broken tier lists fall back to the defaults as a whole. */
export function parseLoyalty(v: unknown): LoyaltySettings {
  const s = rec(v);
  const m = rec(s.milestone);
  const raw = Array.isArray(s.tiers) ? s.tiers.slice(0, 6) : [];
  const tiers: Tier[] = raw.map((t, i) => {
    const r = rec(t);
    return {
      name: str(r.name, 30),
      nameBn: str(r.nameBn, 30),
      min: i === 0 ? 1 : int(r.min, 2, 500, 0),
      perks: str(r.perks, 300),
      perksBn: str(r.perksBn, 300),
    };
  });
  const valid = tiers.length >= 2 && tiers.every((t, i) => t.name && (i === 0 || t.min > tiers[i - 1].min));
  return {
    enabled: s.enabled === true,
    windowMonths: int(s.windowMonths, 1, 36, DEFAULT_LOYALTY.windowMonths),
    tiers: valid ? tiers : DEFAULT_LOYALTY.tiers,
    milestone: {
      every: int(m.every, 0, 50, DEFAULT_LOYALTY.milestone.every),
      reward: str(m.reward, 200),
      rewardBn: str(m.rewardBn, 200),
    },
    goal: parseGoal(s.goal),
    ...(str(s.updatedAt, 40) ? { updatedAt: str(s.updatedAt, 40) } : {}),
  };
}

/** Why settings from the admin form can't be saved; null when they can. */
export function loyaltyProblem(s: LoyaltySettings): string | null {
  if (s.tiers.length < 2) return "Keep at least two tiers.";
  if (s.tiers.some((t) => !t.name)) return "Every tier needs a name.";
  for (let i = 1; i < s.tiers.length; i++) {
    if (!(s.tiers[i].min > s.tiers[i - 1].min)) return `“${s.tiers[i].name}” must need more orders than “${s.tiers[i - 1].name}”.`;
  }
  if (s.milestone.every === 1) return "A reward on every single order is a discount, not a milestone: use 2 or more, or 0 for none.";
  return null;
}

export type LoyaltyCounts = { recent: number; total: number };

export type LoyaltyStatus = {
  /** -1: no order in the window yet. */
  tierIndex: number;
  tier: Tier | null;
  next: Tier | null;
  /** Orders still needed for the next tier (0 at the top). */
  toNext: number;
  /** 0–1 along the way from this tier's threshold to the next one's. */
  progress: number;
  /** Null when no milestone is set up. */
  milestone: { every: number; done: number; toNext: number; reached: number } | null;
};

export function loyaltyStatus(s: LoyaltySettings, counts: LoyaltyCounts): LoyaltyStatus {
  const recent = Math.max(0, Math.floor(counts.recent || 0));
  const total = Math.max(recent, Math.floor(counts.total || 0));
  let tierIndex = -1;
  s.tiers.forEach((t, i) => {
    if (recent >= t.min) tierIndex = i;
  });
  const tier = tierIndex >= 0 ? s.tiers[tierIndex] : null;
  const next = s.tiers[tierIndex + 1] ?? null;
  const from = tier?.min ?? 0;
  const toNext = next ? next.min - recent : 0;
  const progress = next ? Math.min(1, Math.max(0, (recent - from) / (next.min - from))) : 1;
  const every = s.milestone.every;
  const milestone =
    every >= 2 && (s.milestone.reward || s.milestone.rewardBn)
      ? { every, done: total % every, toNext: every - (total % every), reached: Math.floor(total / every) }
      : null;
  return { tierIndex, tier, next, toNext, progress, milestone };
}

/** Tier (or reward) text in the page language; Bangla falls back to English. */
export const inLang = (en: string, bn: string, lang: "en" | "bn") => (lang === "bn" && bn ? bn : en);
