import Link from "@/components/i18n/Link";
import { accountText } from "@/content/i18n/account";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";
import { goalStatus, monthName, type GoalSettings } from "@/lib/customer/goal";
import { inLang, loyaltyStatus, type LoyaltyCounts, type LoyaltySettings } from "@/lib/customer/loyalty";
import type { GoalRead } from "@/lib/customer/portal";

/**
 * Rewards in three lines on the account home (the full cards live on the Rewards tab): the goal,
 * the tier, and how many rewards are waiting. Nothing more than the owner switched on.
 */
export function RewardsStrip({ loyalty, counts, goal, locale }: { loyalty: LoyaltySettings; counts: LoyaltyCounts | null; goal: GoalRead | null; locale: Locale }) {
  const t = accountText(locale).rewards;
  const lines: { key: string; text: string; strong?: boolean }[] = [];
  const money = (n: number) => localDigits(n.toLocaleString("en-IN"), locale);
  if (loyalty.goal.enabled && goal) {
    const s = goalStatus(loyalty.goal as GoalSettings, goal.spend);
    const label = (r: { label: string; labelBn: string }) => inLang(r.label, r.labelBn, locale);
    lines.push({
      key: "goal",
      text: s.next ? fill(t.goalLine, { n: money(s.toNext), reward: label(s.next) }, locale) : fill(t.goalTop, { month: monthName(goal.month, locale) }, locale),
    });
    const open = goal.coupons.filter((c) => c.status === "open").length;
    if (open) lines.push({ key: "coupons", text: open === 1 ? t.couponsOne : fill(t.couponsMany, { n: open }, locale), strong: true });
  }
  if (loyalty.enabled && counts) {
    const s = loyaltyStatus(loyalty, counts);
    const name = (x: { name: string; nameBn: string }) => inLang(x.name, x.nameBn, locale);
    const tier = s.tier ? name(s.tier) : name(loyalty.tiers[0]);
    lines.push({ key: "tier", text: s.next ? fill(t.tierLine, { tier, n: s.toNext, next: name(s.next) }, locale) : fill(t.tierTop, { tier }, locale) });
  }
  if (!lines.length) return null;
  return (
    <section aria-labelledby="rewards-strip-title" className="rounded-lg border border-line bg-white p-5" data-rewards-strip>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="rewards-strip-title" className="font-semibold text-navy">
          {t.strip}
        </h2>
        <Link href="/account/rewards" className="t-small font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-blue">
          {t.open}
        </Link>
      </div>
      <ul className="mt-2.5 space-y-1.5 t-small">
        {lines.map((l) => (
          <li key={l.key} className={l.strong ? "font-semibold text-action" : "text-body"}>
            {l.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
