"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FormText } from "@/content/i18n/forms/en";
import { pathWithoutLocale } from "@/lib/i18n/config";

type Labels = FormText["common"]["appBar"];

// The design's icons (docs/design/velto-app-screens.dc.html).
const icon = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  book: "M12 5v14M5 12h14",
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** The installed app's navigation: Home, Book, Orders, Profile. Only the app shell (/app/*) renders it. */
export function AppTabBar({ t }: { t: Labels }) {
  const path = pathWithoutLocale(usePathname());
  const items = [
    { key: "home", href: "/app/home", label: t.home, active: path === "/app/home" },
    { key: "book", href: "/app/book", label: t.book, active: path.startsWith("/app/book") },
    { key: "orders", href: "/app/orders", label: t.orders, active: path.startsWith("/app/orders") },
    { key: "profile", href: "/app/profile", label: t.profile, active: path.startsWith("/app/profile") || path.startsWith("/app/rewards") },
  ] as const;
  return (
    <nav aria-label={t.label} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]" data-app-tabs>
      <ul className="mx-auto flex max-w-[560px]">
        {items.map((i) => (
          <li key={i.key} className="flex flex-1">
            <Link
              href={i.href}
              aria-current={i.active ? "page" : undefined}
              className={`flex h-16 flex-1 flex-col items-center justify-center gap-[3px] text-[11.5px] font-semibold ${i.active ? "text-action" : "text-[#5b6470]"}`}
            >
              <Icon d={icon[i.key]} />
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
