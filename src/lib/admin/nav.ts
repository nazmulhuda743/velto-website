/**
 * The dashboard menu: groups, names and order. Pure (no React), so the menu each role sees is
 * unit-tested; AdminNav draws it with icons. The server still checks every page's section.
 */
import { sectionForPath } from "./permissions";

export type NavIcon =
  | "home"
  | "funnel"
  | "visitors"
  | "marketing"
  | "revenue"
  | "consent"
  | "today"
  | "riders"
  | "requests"
  | "capacity"
  | "dispatch"
  | "accounts"
  | "health"
  | "retention"
  | "feedback"
  | "coupons"
  | "loyalty"
  | "seo"
  | "images"
  | "copy"
  | "reviews"
  | "settings"
  | "activity"
  | "board"
  | "approvals"
  | "access"
  | "promo"
  | "prices";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
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
      // Today first (spec 2026-10-01 §3); Riders & windows is its settings page.
      { href: "/admin/today", label: "Today", icon: "today" },
      { href: "/admin/riders", label: "Riders & windows", icon: "riders" },
      { href: "/admin/requests", label: "Bookings & quotes", icon: "requests" },
      { href: "/admin/dispatch", label: "Pickup & delivery", icon: "dispatch" },
      { href: "/admin/capacity", label: "Capacity", icon: "capacity" },
      { href: "/admin/retention", label: "Bring customers back", icon: "retention" },
      { href: "/admin/feedback", label: "Customer feedback", icon: "feedback" },
      { href: "/admin/loyalty", label: "Loyalty", icon: "loyalty" },
      { href: "/admin/coupons", label: "Goal coupons", icon: "coupons" },
      { href: "/admin/accounts", label: "Customer accounts", icon: "accounts" },
      { href: "/admin/health", label: "Website health", icon: "health" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/seo", label: "SEO", icon: "seo" },
      { href: "/admin/images", label: "Images", icon: "images" },
      { href: "/admin/copy", label: "Text & copy", icon: "copy" },
      { href: "/admin/copy/footer", label: "Footer links", icon: "copy" },
      { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
      { href: "/admin/promo", label: "Promo & popup", icon: "promo" },
      { href: "/admin/settings", label: "Site settings", icon: "settings" },
      { href: "/admin/prices", label: "Prices", icon: "prices" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/admin/board", label: "Task board", icon: "board" },
      { href: "/admin/approvals", label: "Approvals", icon: "approvals" },
      { href: "/admin/activity", label: "Activity", icon: "activity" },
      { href: "/admin/access", label: "Access", icon: "access" },
    ],
  },
];

/** The menu for someone who may open these sections: empty groups are left out. */
export function navFor(allowed: readonly string[]): NavGroup[] {
  const may = (href: string) => {
    const section = sectionForPath(href);
    return section !== null && allowed.includes(section);
  };
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => may(i.href)) })).filter((g) => g.items.length);
}

