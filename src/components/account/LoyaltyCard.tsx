import { accountText } from "@/content/i18n/account";
import { fill, localDigits, type Locale } from "@/lib/i18n/config";
import { inLang, loyaltyStatus, type LoyaltyCounts, type LoyaltySettings } from "@/lib/customer/loyalty";

/**
 * The customer's tier, how far to the next one, and (when the owner has set one up) the
 * milestone reward. Everything comes from their own order counts and the admin's Loyalty
 * settings; benefits and rewards are shown only as the owner wrote them.
 */
export function LoyaltyCard({ settings, counts, locale }: { settings: LoyaltySettings; counts: LoyaltyCounts; locale: Locale }) {
  const t = accountText(locale).loyalty;
  const s = loyaltyStatus(settings, counts);
  const name = (tier: { name: string; nameBn: string }) => inLang(tier.name, tier.nameBn, locale);
  const perks = s.tier ? inLang(s.tier.perks, s.tier.perksBn, locale) : "";
  const nextPerks = s.next ? inLang(s.next.perks, s.next.perksBn, locale) : "";
  const reward = inLang(settings.milestone.reward, settings.milestone.rewardBn, locale);
  const m = settings.windowMonths;

  return (
    <section aria-labelledby="loyalty-title" className="overflow-hidden rounded-lg border border-line bg-white" data-loyalty-card>
      <div className="bg-navy px-5 py-5 text-white md:px-7 md:py-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="t-label uppercase text-white/70">{t.label}</p>
            <h2 id="loyalty-title" className="mt-1 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[36px]">
              {s.tier ? name(s.tier) : name(settings.tiers[0])}
            </h2>
          </div>
          {/* Tier ladder: where the customer sits among all tiers. */}
          <ol className="flex items-center gap-1.5" aria-label={settings.tiers.map(name).join(", ")}>
            {settings.tiers.map((tier, i) => (
              <li
                key={tier.name}
                title={name(tier)}
                className={`h-2 rounded-full ${i <= s.tierIndex ? "bg-cyan" : "bg-white/25"} ${i === s.tierIndex ? "w-8" : "w-4"}`}
              >
                <span className="sr-only">
                  {name(tier)}
                  {i === s.tierIndex ? " ✓" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-2 t-small text-white/80">
          {s.tierIndex < 0 ? t.none : fill(counts.recent === 1 ? t.ordersOne : t.orders, { n: counts.recent, m }, locale)}
        </p>
      </div>

      <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
        {s.next ? (
          <div>
            <p className="font-semibold text-navy">{fill(s.toNext === 1 ? t.toNextOne : t.toNext, { n: s.toNext, tier: name(s.next) }, locale)}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={s.next.min}
              aria-valuenow={Math.min(counts.recent, s.next.min)}
              aria-label={fill(t.progressAria, { done: Math.min(counts.recent, s.next.min), total: s.next.min, tier: name(s.next) }, locale)}
              className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-soft"
            >
              <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(4, Math.round(s.progress * 100))}%` }} />
            </div>
            {nextPerks ? <p className="mt-2 t-small text-secondary">{fill(t.nextPerks, { tier: name(s.next), perks: nextPerks }, locale)}</p> : null}
          </div>
        ) : (
          <p className="font-semibold text-navy">{t.top}</p>
        )}

        {perks ? (
          <div>
            <h3 className="t-small font-semibold uppercase tracking-[0.04em] text-secondary">{t.perksTitle}</h3>
            <p className="mt-1 text-body">{perks}</p>
          </div>
        ) : null}

        {s.milestone ? (
          <div className="rounded-md bg-soft p-4">
            <h3 className="font-semibold text-navy">{fill(t.milestoneTitle, { n: s.milestone.every }, locale)}</h3>
            {reward ? <p className="mt-0.5 t-small text-body">{fill(t.milestoneReward, { reward }, locale)}</p> : null}
            <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={fill(t.stampAria, { done: s.milestone.done, n: s.milestone.every }, locale)}>
              {Array.from({ length: s.milestone.every }, (_, i) => (
                <li
                  key={i}
                  aria-hidden="true"
                  className={`flex size-8 items-center justify-center rounded-full border text-[13px] font-semibold ${
                    i < s.milestone!.done ? "border-action bg-action text-white" : i === s.milestone!.every - 1 ? "border-dashed border-action text-action" : "border-line-strong text-secondary"
                  }`}
                >
                  {i < s.milestone!.done ? "✓" : i === s.milestone!.every - 1 ? "★" : localDigits(i + 1, locale)}
                </li>
              ))}
            </ol>
            <p className="mt-2 t-small text-secondary">
              {s.milestone.toNext === 1 ? t.milestoneNextOne : fill(t.milestoneProgress, { done: s.milestone.done, n: s.milestone.every }, locale)}
            </p>
            {s.milestone.reached > 0 ? <p className="mt-0.5 t-small text-secondary">{fill(t.milestoneEarned, { n: s.milestone.reached }, locale)}</p> : null}
          </div>
        ) : null}

        <p className="t-caption text-secondary">{fill(t.howItWorks, { m }, locale)}</p>
      </div>
    </section>
  );
}
