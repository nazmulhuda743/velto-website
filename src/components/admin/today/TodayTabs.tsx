import Link from "next/link";
import type { TodayText } from "@/content/i18n/admin-today";
import type { TodayTab } from "@/lib/admin/today-logic";
import { Icon, type IconName } from "./icons";

const TABS: { id: TodayTab; icon: IconName }[] = [
  { id: "call", icon: "phone" },
  { id: "assign", icon: "bike" },
  { id: "deliver", icon: "bag" },
  { id: "route", icon: "route" },
];

/**
 * Call · Assign · Deliver · Route in the thumb zone, each with its count. Links (the tab is in the
 * URL, rendered on the server). The Call count turns red when someone has waited over 30 minutes.
 */
export function TodayTabs({ active, counts, late, href, t }: { active: TodayTab | null; counts: Record<TodayTab, number>; late: boolean; href: (tab: TodayTab) => string; t: TodayText }) {
  return (
    <nav aria-label={t.lists} className="grid grid-cols-4 gap-1 px-1.5 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))]">
      {TABS.map(({ id, icon }) => {
        const n = counts[id];
        const red = id === "call" && late && n > 0;
        const on = active === id;
        return (
          <Link
            key={id}
            href={href(id)}
            aria-current={on ? "page" : undefined}
            aria-label={`${t.tabs[id]}${n ? `, ${t.tabCount(n)}` : ""}${red ? `, ${t.tabLate}` : ""}`}
            className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-[10px] text-[13px] font-semibold ${on ? "bg-soft text-navy" : "text-secondary hover:bg-soft/70 hover:text-navy"}`}
          >
            <Icon name={icon} className="size-[22px]" />
            <span>{t.tabs[id]}</span>
            {n ? (
              <span
                aria-hidden="true"
                className={`absolute top-1 left-[calc(50%+4px)] grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-semibold tabular-nums text-white ${red ? "bg-error" : "bg-navy"}`}
              >
                {t.num(n)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
