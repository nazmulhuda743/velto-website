import { redirect } from "next/navigation";
import { GoalCard } from "@/components/account/GoalCard";
import { LoyaltyCard } from "@/components/account/LoyaltyCard";
import { accountText } from "@/content/i18n/account";
import { getLocale, loginRedirectPath } from "@/lib/i18n/server";
import { getCustomerSession, getGoal, getLoyaltyCounts } from "@/lib/customer/portal";
import { getSiteContent } from "@/lib/site-content";

/** The monthly goal, the tier and the rewards held, in full. The home shows a three-line strip. */
export default async function RewardsPage() {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready") redirect(await loginRedirectPath("/account/rewards"));
  const { loyalty } = await getSiteContent();
  if (!loyalty.enabled && !loyalty.goal.enabled) redirect("/account");
  const linked = session.account.link.status === "linked";
  const [goal, counts] = linked
    ? await Promise.all([loyalty.goal.enabled ? getGoal(loyalty.goal.doubleFirst) : null, loyalty.enabled ? getLoyaltyCounts(loyalty.windowMonths) : null])
    : [null, null];
  const locale = await getLocale();
  const t = accountText(locale).rewards;
  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="t-h1 text-navy">{t.title}</h1>
        <p className="mt-2 max-w-[60ch] text-body">{t.intro}</p>
      </header>
      {loyalty.goal.enabled && goal ? <GoalCard settings={loyalty.goal} goal={goal} locale={locale} /> : null}
      {loyalty.enabled && counts ? <LoyaltyCard settings={loyalty} counts={counts} locale={locale} /> : null}
      {!goal && !counts ? <p className="rounded-lg border border-dashed border-line-strong bg-white px-5 py-6 t-small text-secondary">{t.none}</p> : null}
    </div>
  );
}
