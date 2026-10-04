"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/i18n/Link";
import type { FormText } from "@/content/i18n/forms/en";
import { WHATSAPP_URL } from "@/content/site";
import { splitAppPath } from "@/lib/pwa/install-card";

type Labels = FormText["common"]["appBar"];

const icon = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  book: "M12 5v14M5 12h14",
  orders: "M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9.5 9h5M9.5 13h5",
  help: "M5 18.5 6.2 15A7 7 0 1 1 9 17.8z",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/**
 * The installed app's own navigation: Home (the account), Book, Orders, Help (WhatsApp). Rendered
 * on every page but shown only inside the app (html[data-app], globals.css); the website never sees it.
 */
export function AppTabBar({ t }: { t: Labels }) {
  const path = splitAppPath(usePathname()).path;
  const items = [
    { key: "home", href: "/account", label: t.home, active: path === "/account" || path === "/account/profile" || path === "/account/rewards" },
    { key: "book", href: "/book", label: t.book, active: path === "/book" },
    { key: "orders", href: "/account/orders", label: t.orders, active: path.startsWith("/account/orders") || path === "/track" },
  ] as const;
  const cell = "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold";
  return (
    <nav
      aria-label={t.label}
      data-app-chrome
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-[560px]">
        {items.map((i) => (
          <li key={i.key} className="flex flex-1">
            <Link href={i.href} aria-current={i.active ? "page" : undefined} className={`${cell} ${i.active ? "text-action" : "text-secondary"}`}>
              <Icon d={icon[i.key]} />
              {i.label}
            </Link>
          </li>
        ))}
        <li className="flex flex-1">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`${cell} text-secondary`} data-analytics="whatsapp_click" data-placement="app_bar">
            <Icon d={icon.help} />
            {t.help}
          </a>
        </li>
      </ul>
    </nav>
  );
}
