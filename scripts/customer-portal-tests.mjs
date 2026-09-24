import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const must = (condition, message) => { if (!condition) throw new Error(message); };

const server = read("src/lib/supabase/portal-server.ts");
const proxy = read("src/lib/supabase/portal-proxy.ts");
const portal = read("src/lib/customer-portal.ts");
const actions = read("src/app/(site)/auth-actions.ts");
const detail = read("src/app/(site)/account/orders/[id]/page.tsx");
const profile = read("src/app/(site)/account/profile/page.tsx");
const book = read("src/app/(site)/book/page.tsx");
const session = read("src/app/api/account/session/route.ts");

must(server.includes("auth.getClaims()"), "portal authorization must verify JWT claims");
must(server.includes("auth.getUser()"), "portal authorization must refresh user state for disabled/deleted users");
must(proxy.includes("auth.getClaims()"), "proxy must refresh and verify portal sessions");
must(portal.includes('"portal_order_get"'), "order detail must use customer-safe RPC");
must(portal.includes("/^VELR?-\\d{5}$/"), "order references must be bounded before RPC");
must(!portal.includes("service_role") && !server.includes("service_role"), "portal runtime must never use a service-role client");
must(!actions.includes("customer_id") && !detail.includes("customer_id"), "customer identity must never come from browser/path parameters");
must(actions.includes("linkedIdentity") && actions.includes("current.phone"), "linked phone changes must be ignored server-side");
must(profile.includes("cannot be silently changed"), "profile must explain phone identity protection");
must(book.includes("portalMe") && book.includes("prefill"), "booking page must derive prefill from authenticated server profile");
must(session.includes('"Cache-Control": "private, no-store"'), "session endpoint must not be cached");

const forbidden = ["staff_notes", "internal_qc", "internal routing", "rider_phone", "cost_price"];
for (const token of forbidden) must(!portal.toLowerCase().includes(token), `customer portal exposes forbidden field: ${token}`);

for (const route of ["login", "signup", "forgot-password", "reset-password", "account", "account/orders", "account/profile"]) {
  const path = `src/app/(site)/${route}/page.tsx`;
  must(fs.existsSync(path), `missing portal route: ${route}`);
}
must(fs.existsSync("src/app/(site)/account/orders/[id]/page.tsx"), "missing order detail route");
console.log("customer portal static security checks passed");
