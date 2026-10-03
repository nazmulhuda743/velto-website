/**
 * Who can open which part of the Website Command Center. Pure (no imports), so the whole
 * matrix is unit-tested. Every admin page and server action checks its section on the
 * server; hiding a menu item is only a convenience.
 *
 * Velto Ops admins (profiles.role = "admin") are always Owners, so the business can never
 * be locked out of its own dashboard. Everyone else gets exactly one website role from the
 * Access page.
 */

export const ROLES = ["owner", "manager", "marketing", "designer", "support"] as const;
export type Role = (typeof ROLES)[number];

export const SECTIONS = [
  "overview",
  "funnel",
  "visitors",
  "marketing",
  "revenue",
  "consent",
  "requests",
  "dispatch",
  "capacity",
  "riders",
  "retention",
  "feedback",
  "loyalty",
  "coupons",
  "accounts",
  "health",
  "seo",
  "images",
  "copy",
  "reviews",
  "settings",
  "promo",
  "prices",
  "notifications",
  "board",
  "activity",
  "approvals",
  "access",
] as const;
export type Section = (typeof SECTIONS)[number];

export const ROLE_INFO: Record<Role, { label: string; summary: string }> = {
  owner: { label: "Owner", summary: "Everything, including who has access and approving price changes." },
  manager: { label: "Manager", summary: "Everything except Staff access and Price approvals. Price changes wait for an Owner's approval." },
  marketing: { label: "Marketing", summary: "Traffic, funnel, campaigns, revenue, consent, loyalty numbers, SEO, website text, reviews and the promo bar & popup." },
  designer: { label: "Designer", summary: "Images, logo, website text, SEO text, reviews, promo bar & popup and site settings. No customer data." },
  support: { label: "Customer support", summary: "Bookings, pickup & delivery, bring-back list, customer feedback, goal coupons, customer accounts and prices." },
};

const ALL = new Set<Section>(SECTIONS);
const MATRIX: Record<Role, ReadonlySet<Section>> = {
  owner: ALL,
  manager: new Set(SECTIONS.filter((s) => s !== "access" && s !== "approvals")),
  marketing: new Set<Section>(["overview", "funnel", "visitors", "marketing", "revenue", "consent", "loyalty", "coupons", "seo", "copy", "reviews", "promo", "notifications", "board"]),
  designer: new Set<Section>(["images", "copy", "seo", "reviews", "promo", "settings", "board"]),
  support: new Set<Section>(["requests", "dispatch", "capacity", "retention", "feedback", "coupons", "accounts", "prices", "notifications", "board"]),
};

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

export function can(role: Role | null | undefined, section: Section): boolean {
  return Boolean(role && MATRIX[role]?.has(section));
}

/**
 * Pages whose folder isn't their section: Today is the dispatch section's screen (spec 2026-10-01 §3);
 * Invoices on WhatsApp belongs to whoever handles pickups and deliveries.
 */
const PATH_SECTION: Record<string, Section> = { today: "dispatch", invoices: "dispatch" };

/** Dashboard path → section. Unknown admin paths belong to no section (so nobody but owners). */
export function sectionForPath(path: string): Section | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/admin";
  if (clean === "/admin") return "overview";
  const first = clean.replace(/^\/admin\//, "").split("/")[0];
  if (Object.hasOwn(PATH_SECTION, first)) return PATH_SECTION[first];
  return (SECTIONS as readonly string[]).includes(first) ? (first as Section) : null;
}

/**
 * Where a role lands after signing in: their first allowed section, in this order. Everyone who
 * schedules pickups and deliveries (the dispatch section) starts on Today (spec 2026-10-01 §3).
 */
const MENU_ORDER: Section[] = ["dispatch", "overview", "requests", "images", "funnel", "retention", "seo"];
const HOME_PATH: Partial<Record<Section, string>> = { overview: "/admin", dispatch: "/admin/today" };
export function homeFor(role: Role): string {
  const first = MENU_ORDER.find((s) => can(role, s)) ?? SECTIONS.find((s) => can(role, s));
  return first ? (HOME_PATH[first] ?? `/admin/${first}`) : "/admin";
}

export type AdminAccess = {
  profile: { name: string | null; email: string | null; role: string; active: boolean } | null;
  member: { name: string; email: string; role: string; active: boolean } | null;
};

export type AdminIdentity = { id: string; name: string; email: string; role: Role };

/**
 * Who may use the dashboard, and as what. Ops admins are always Owners (the business can't be
 * locked out); deactivated Ops staff are refused whatever website role they had; everyone else
 * needs an active website role from the Access page.
 */
export function resolveAdmin(uid: string, access: AdminAccess | null): AdminIdentity | null {
  if (!access) return null;
  const { profile, member } = access;
  if (profile && !profile.active) return null;
  let role: Role | null = null;
  if (profile?.role === "admin") role = "owner";
  else if (member?.active && isRole(member.role)) role = member.role;
  if (!role) return null;
  const email = member?.email || profile?.email || "";
  const name = member?.name || profile?.name || email || "Admin";
  return { id: uid, name, email, role };
}

/** Temporary password rule for logins created from the Access page. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use a temporary password of at least 12 characters.";
  if (password.length > 72) return "Use 72 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}

/**
 * Proposing price changes (add, edit, remove, restore). Managers' changes wait on the Approvals
 * page; an Owner's own change is approved as it is made. Everyone else with Prices only views.
 */
export const canProposePrices = (role: Role | null | undefined) => role === "owner" || role === "manager";

/** Archiving a board task (there is no delete) is for Owners and Managers. */
export const canArchiveTasks = (role: Role | null | undefined) => role === "owner" || role === "manager";

/**
 * Pickup & delivery capacity: Owners and Managers set it (windows, zones, numbers, blocks) and may
 * book over a full window with a reason. Customer support sees the board and books within capacity.
 */
export const canEditCapacity = (role: Role | null | undefined) => role === "owner" || role === "manager";

/** Changing loyalty tiers, benefits and rewards is a business decision: Owners only. Others view. */
export const canEditLoyalty = (role: Role | null | undefined) => role === "owner";
