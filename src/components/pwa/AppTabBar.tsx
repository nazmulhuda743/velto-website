"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FormText } from "@/content/i18n/forms/en";
import { pathWithoutLocale } from "@/lib/i18n/config";

type Labels = FormText["common"]["appBar"];

const icon = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  book: "M12 5v14M5 12h14",
  orders: "M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9.5 9h5M9.5 13h5",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** The installed app's navigation: Home, Book, Orders, Profile. Only the app shell (/app/*) renders it. */
export function AppTabBar({ t }: { t: Labels }) {
  const path = pathWithoutLocale(usePathname());
  const items = [
    { key: "home", href: "/app/home", label: t.home, active: path === "/app/home" || path.startsWith("/app/prices") },
    { key: "book", href: "/app/book", label: t.book, active: path.startsWith("/app/book") },
    { key: "orders", href: "/app/orders", label: t.orders, active: path.startsWith("/app/orders") },
    { key: "profile", href: "/app/profile", label: t.profile, active: path.startsWith("/app/profile") || path.startsWith("/app/rewards") },
  ] as const;
  return (
    <nav aria-label={t.label} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" data-app-tabs>
      <ul className="mx-auto flex max-w-[560px]">
        {items.map((i) => (
          <li key={i.key} className="flex flex-1">
            <Link
              href={i.href}
              aria-current={i.active ? "page" : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${i.active ? "text-action" : "text-secondary"}`}
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
