"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** 20px line icons, one per section, so the menu scans by shape as well as by word. */
const I = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-7.5Z" />,
  funnel: <path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z" />,
  visitors: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.3A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  marketing: <path d="M4 10v4h3l6 4V6L7 10H4ZM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />,
  revenue: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16v-4M12 16V8M17 16v-6" />
    </>
  ),
  consent: <path d="M12 3.5 5 6.5v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9v-5l-7-3ZM9 12l2 2 4-4" />,
  requests: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16M8.5 14h3M8.5 17h6" />
    </>
  ),
  accounts: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  health: <path d="M3.5 12h4l2-5 4 10 2-5h5" />,
  retention: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  seo: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  images: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 16-5-5-8.5 8" />
    </>
  ),
  reviews: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
    </>
  ),
  activity: (
    <>
      <path d="M4 6h16M4 12h10M4 18h7" />
      <circle cx="18" cy="16.5" r="3" />
      <path d="M18 15v1.6l1 .8" />
    </>
  ),
  approvals: (
    <>
      <path d="M9 11.5 11 13.5 15.5 9" />
      <path d="M12 3.5 5 6.5v5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9v-5l-7-3Z" />
    </>
  ),
  access: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
    </>
  ),
  prices: (
    <>
      <path d="M11.5 4H5v6.5l8.5 8.5 6.5-6.5L11.5 4Z" />
      <circle cx="8.5" cy="7.5" r="1.2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

type Item = { href: string; label: string; icon: keyof typeof I };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Insights",
    items: [
      { href: "/admin", label: "Overview", icon: "home" },
      { href: "/admin/funnel", label: "Funnel", icon: "funnel" },
      { href: "/admin/visitors", label: "Visitors", icon: "visitors" },
      { href: "/admin/marketing", label: "Marketing", icon: "marketing" },
      { href: "/admin/revenue", label: "Revenue", icon: "revenue" },
      { href: "/admin/consent", label: "Consent & tracking", icon: "consent" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/requests", label: "Bookings & quotes", icon: "requests" },
      { href: "/admin/retention", label: "Bring customers back", icon: "retention" },
      { href: "/admin/accounts", label: "Customer accounts", icon: "accounts" },
      { href: "/admin/health", label: "Website health", icon: "health" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/seo", label: "SEO", icon: "seo" },
      { href: "/admin/images", label: "Images", icon: "images" },
      { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
      { href: "/admin/settings", label: "Site settings", icon: "settings" },
      { href: "/admin/prices", label: "Prices", icon: "prices" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/admin/approvals", label: "Approvals", icon: "approvals" },
      { href: "/admin/activity", label: "Activity", icon: "activity" },
      { href: "/admin/access", label: "Access", icon: "access" },
    ],
  },
];

const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

function Icon({ name }: { name: keyof typeof I }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {I[name]}
    </svg>
  );
}

function Links({ path, badges, groups, onNavigate }: { path: string; badges: Record<string, number>; groups: typeof GROUPS; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 t-caption font-semibold uppercase tracking-[0.08em] text-white/65">{group.label}</p>
          {group.items.map((item) => {
            const active = isActive(item.href, path);
            const count = badges[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[15px] font-medium ${
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-cyan" /> : null}
                <Icon name={item.icon} />
                <span className="flex-1 truncate">{item.label}</span>
                {count ? (
                  <span className="rounded-full bg-cyan px-2 text-[12px] font-bold leading-5 text-navy tabular-nums">
                    {count > 99 ? "99+" : count}
                    <span className="sr-only"> open</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard navigation. Desktop: grouped sidebar with icons and live counts.
 * Mobile: the current section plus a Menu button that opens the same grouped
 * list, instead of a long sideways-scrolling strip.
 */
/** "/admin" → "overview", "/admin/images" → "images" (same rule as lib/admin/permissions). */
const sectionOf = (href: string) => (href === "/admin" ? "overview" : href.split("/")[2]);

export function AdminNav({ badges = {}, allowed }: { badges?: Record<string, number>; allowed: string[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Only the sections this role may open (the server enforces it too).
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(sectionOf(i.href))) })).filter((g) => g.items.length);
  const current = groups.flatMap((g) => g.items).find((i) => isActive(i.href, path));
  const total = Object.values(badges).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav aria-label="Dashboard">
      <div className="hidden lg:block">
        <Links path={path} badges={badges} groups={groups} />
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center gap-3 rounded-md bg-white/8 px-3 text-left text-[15px] font-semibold text-white"
        >
          {current ? <Icon name={current.icon} /> : null}
          <span className="flex-1 truncate">{current?.label ?? "Menu"}</span>
          {!open && total ? (
            <span className="rounded-full bg-cyan px-2 text-[12px] font-bold leading-5 text-navy tabular-nums">{total > 99 ? "99+" : total}</span>
          ) : null}
          <span className="t-small font-medium text-white/70">{open ? "Close" : "Menu"}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open ? (
          <div id="admin-mobile-menu" className="mt-3 border-t border-white/15 pb-2 pt-4">
            <Links path={path} badges={badges} groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
