import { accountText } from "@/content/i18n/account";
import { fill, type Locale } from "@/lib/i18n/config";
import { todayDhaka } from "@/lib/customer/goal";
import type { DispatchPlan } from "@/lib/customer/portal";

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** "Today, Evening 5–9 PM with Rakib" for a plan; null when it is neither today nor tomorrow. */
export function planWhen(plan: DispatchPlan, locale: Locale, today = todayDhaka()): string | null {
  const t = accountText(locale).plan;
  const when = plan.slotDate === today ? t.today : plan.slotDate === nextDay(today) ? t.tomorrow : null;
  if (!when) return null;
  return `${when}, ${t.slots[plan.slot]}${plan.assigneeName ? ` · ${fill(t.with, { name: plan.assigneeName }, locale)}` : ""}`;
}

/**
 * The one thing a customer wants to know on the day: the rider is coming today (or tomorrow),
 * in this window. From the dispatch board; nothing shows until a manager has planned the stop.
 */
export function PlanBanner({ plans, locale }: { plans: DispatchPlan[]; locale: Locale }) {
  const t = accountText(locale).plan;
  const today = todayDhaka();
  const soon = plans.map((p) => ({ p, when: planWhen(p, locale, today) })).filter((x): x is { p: DispatchPlan; when: string } => !!x.when);
  if (!soon.length) return null;
  return (
    <ul className="space-y-3" data-plan-banner>
      {soon.map(({ p, when }) => (
        <li key={`${p.kind}-${p.orderNumber ?? p.slotDate}`} className="flex gap-4 rounded-lg border border-action bg-[#f0f7fc] p-4 md:p-5">
          <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-action text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {p.kind === "pickup" ? <path d="M4 17h2a3 3 0 0 0 6 0h2a3 3 0 0 0 6 0h1v-5l-3-4h-4V6H4v11ZM14 8v4h5" /> : <path d="M4 17h2a3 3 0 0 0 6 0h2a3 3 0 0 0 6 0h1v-5l-3-4h-4V6H4v11ZM9 11l2 2 4-4" />}
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-navy">
              {p.kind === "pickup" ? t.pickup : t.delivery}
              {p.orderNumber ? <span className="font-normal text-secondary"> · {p.orderNumber}</span> : null}
            </span>
            <span className="block text-[17px] font-semibold text-navy">{when}</span>
            <span className="mt-0.5 block t-small text-body">{p.kind === "pickup" ? t.pickupBody : t.deliveryBody}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
