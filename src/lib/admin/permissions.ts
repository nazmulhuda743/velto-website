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
  "retention",
  "accounts",
  "health",
  "seo",
  "images",
  "reviews",
  "settings",
  "prices",
  "notifications",
  "activity",
  "approvals",
  "access",
] as const;
export type Section = (typeof SECTIONS)[number];

export const ROLE_INFO: Record<Role, { label: string; summary: string }> = {
  owner: { label: "Owner", summary: "Everything, including who has access and approving price changes." },
  manager: { label: "Manager", summary: "Everything except Access and Approvals. Price changes wait for an Owner's approval." },
  marketing: { label: "Marketing", summary: "Traffic, funnel, campaigns, revenue, consent, SEO and reviews." },
  designer: { label: "Designer", summary: "Images, SEO text, reviews and site settings. No customer data." },
  support: { label: "Customer support", summary: "Bookings, bring-back list, customer accounts and prices." },
};

const ALL = new Set<Section>(SECTIONS);
const MATRIX: Record<Role, ReadonlySet<Section>> = {
  owner: ALL,
  manager: new Set(SECTIONS.filter((s) => s !== "access" && s !== "approvals")),
  marketing: new Set<Section>(["overview", "funnel", "visitors", "marketing", "revenue", "consent", "seo", "reviews", "notifications"]),
  designer: new Set<Section>(["images", "seo", "reviews", "settings"]),
  support: new Set<Section>(["requests", "retention", "accounts", "prices", "notifications"]),
};

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

export function can(role: Role | null | undefined, section: Section): boolean {
  return Boolean(role && MATRIX[role]?.has(section));
}

/** Dashboard path → section. Unknown admin paths belong to no section (so nobody but owners). */
export function sectionForPath(path: string): Section | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/admin";
  if (clean === "/admin") return "overview";
  const first = clean.replace(/^\/admin\//, "").split("/")[0];
  return (SECTIONS as readonly string[]).includes(first) ? (first as Section) : null;
}

/** Where a role lands after signing in (their first allowed section, in menu order). */
const MENU_ORDER: Section[] = ["overview", "requests", "images", "funnel", "retention", "seo"];
export function homeFor(role: Role): string {
  const first = MENU_ORDER.find((s) => can(role, s)) ?? SECTIONS.find((s) => can(role, s));
  return !first || first === "overview" ? "/admin" : `/admin/${first}`;
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
