import Link from "next/link";

const TABS = [
  { href: "/admin/revenue", label: "Overview" },
  { href: "/admin/revenue/customers", label: "Customers" },
  { href: "/admin/revenue/spend", label: "Campaign spend" },
  { href: "/admin/revenue/review", label: "Review queue" },
];

export function RevenueTabs({ active, reviewCount }: { active: string; reviewCount?: number }) {
  return (
    <nav aria-label="Revenue" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 t-small font-semibold ${
            active === t.href ? "border-navy text-navy" : "border-transparent text-secondary hover:text-navy"
          }`}
        >
          {t.label}
          {t.href.endsWith("review") && reviewCount ? (
            <span className="ml-1.5 rounded-full bg-[#fff4e5] px-1.5 py-0.5 t-caption font-bold text-[#8a5300]">{reviewCount}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
