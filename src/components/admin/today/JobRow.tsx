import Link from "next/link";
import type { TodayText } from "@/content/i18n/admin-today";
import { dayWord } from "./format";
import { Icon } from "./icons";
import type { ListItem } from "./items";
import { WaitPill } from "./NextUpCard";

/** The line under a row's name: where, and when or which order. */
function subline(item: ListItem, today: string, t: TodayText) {
  if (item.tab === "call") return [item.place, item.asked].filter(Boolean).join(" · ");
  if (item.tab === "assign") return [item.place, dayWord(item.date, today, t), item.slot ? t.windows[item.slot] : ""].filter(Boolean).join(" · ");
  return [item.place, item.order].filter(Boolean).join(" · ");
}

/** "Then": one compact row per other job. Tapping it makes it Next up (`?job=`). */
export function JobRow({ item, href, today, t }: { item: ListItem; href: string; today: string; t: TodayText }) {
  return (
    <li className="border-b border-line">
      <Link href={href} className="grid min-h-[64px] grid-cols-[1fr_auto] items-center gap-x-3 rounded-[8px] px-0.5 py-3 hover:bg-soft/70">
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[16px] font-semibold text-navy">{item.name}</span>
            {item.badges.first ? <span className="shrink-0 rounded-[6px] bg-success-soft px-1.5 text-[12px] font-semibold text-success">{t.num(10)}%</span> : null}
            {item.badges.weekly ? <Icon name="repeat" className="size-3.5 text-secondary" /> : null}
          </span>
          <span className="block truncate text-[14px] text-secondary">{subline(item, today, t)}</span>
        </span>
        {item.tab === "call" ? <WaitPill minutes={item.minutes} late={item.late} t={t} /> : <Icon name="chevron" className="size-5 text-secondary" />}
      </Link>
    </li>
  );
}
