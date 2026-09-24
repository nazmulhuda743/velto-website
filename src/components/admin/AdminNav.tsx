"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Bookings & quotes" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/images", label: "Images" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Site settings" },
  { href: "/admin/prices", label: "Prices" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map((item) => {
        const active = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2.5 text-[15px] font-medium ${
              active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
