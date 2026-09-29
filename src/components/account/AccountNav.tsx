"use client";

import Link from "@/components/i18n/Link";
import { usePathname } from "next/navigation";
import { pathWithoutLocale } from "@/lib/i18n/config";

type Labels = { overview: string; orders: string; rewards: string; profile: string; aria: string };

const tabs = (l: Labels, rewards: boolean) => [
  { href: "/account", label: l.overview, match: (p: string) => p === "/account" },
  { href: "/account/orders", label: l.orders, match: (p: string) => p.startsWith("/account/orders") },
  ...(rewards ? [{ href: "/account/rewards", label: l.rewards, match: (p: string) => p.startsWith("/account/rewards") }] : []),
  { href: "/account/profile", label: l.profile, match: (p: string) => p.startsWith("/account/profile") },
];

/** Account sections. Desktop: a quiet side list. Phones: equal tabs under the header (Rewards only when switched on). */
export function AccountNav({ variant, labels, rewards = false }: { variant: "side" | "tabs"; labels: Labels; rewards?: boolean }) {
  const path = pathWithoutLocale(usePathname());
  const TABS = tabs(labels, rewards);
  if (variant === "tabs") {
    return (
      <nav aria-label={labels.aria} className="border-b border-line bg-white xl:hidden">
        <ul className={`container-page grid ${TABS.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {TABS.map((t) => {
            const active = t.match(path);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center justify-center border-b-2 px-1 text-center text-[15px] font-semibold ${TABS.length === 4 ? "max-[359px]:text-[14px]" : ""} ${active ? "border-blue text-navy" : "border-transparent text-secondary hover:text-navy"}`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label={labels.aria}>
      <ul className="space-y-1">
        {TABS.map((t) => {
          const active = t.match(path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center rounded-md px-3 text-[15px] font-medium ${active ? "bg-soft font-semibold text-navy" : "text-body hover:bg-soft hover:text-navy"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
