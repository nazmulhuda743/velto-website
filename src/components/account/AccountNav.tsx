"use client";

import Link from "@/components/i18n/Link";
import { usePathname } from "next/navigation";
import { pathWithoutLocale } from "@/lib/i18n/config";

const TABS = [
  { href: "/account", label: "Overview", match: (p: string) => p === "/account" },
  { href: "/account/orders", label: "My Orders", match: (p: string) => p.startsWith("/account/orders") },
  { href: "/account/profile", label: "Profile", match: (p: string) => p.startsWith("/account/profile") },
];

/** Account sections. Desktop: a quiet side list. Phones: three equal tabs under the header. */
export function AccountNav({ variant }: { variant: "side" | "tabs" }) {
  const path = pathWithoutLocale(usePathname());
  if (variant === "tabs") {
    return (
      <nav aria-label="Account" className="border-b border-line bg-white xl:hidden">
        <ul className="container-page grid grid-cols-3">
          {TABS.map((t) => {
            const active = t.match(path);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center justify-center border-b-2 text-[15px] font-semibold ${active ? "border-blue text-navy" : "border-transparent text-secondary hover:text-navy"}`}
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
    <nav aria-label="Account">
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
