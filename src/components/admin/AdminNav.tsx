"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Insights",
    items: [
      { href: "/admin", label: "Command center" },
      { href: "/admin/funnel", label: "Funnel" },
      { href: "/admin/visitors", label: "Visitors" },
      { href: "/admin/marketing", label: "Marketing" },
      { href: "/admin/consent", label: "Consent & tracking" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/requests", label: "Bookings & quotes" },
      { href: "/admin/accounts", label: "Customer accounts" },
      { href: "/admin/health", label: "Website health" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/seo", label: "SEO" },
      { href: "/admin/images", label: "Images" },
      { href: "/admin/reviews", label: "Reviews" },
      { href: "/admin/settings", label: "Site settings" },
      { href: "/admin/prices", label: "Prices" },
    ],
  },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <div className="flex gap-1 lg:flex-col lg:gap-6">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex gap-1 lg:flex-col">
            <p className="hidden px-3 pb-1 t-caption font-semibold uppercase tracking-[0.08em] text-white/45 lg:block">{group.label}</p>
            {group.items.map((item) => {
              const active = item.href === "/admin" ? path === "/admin" : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-medium ${
                    active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
