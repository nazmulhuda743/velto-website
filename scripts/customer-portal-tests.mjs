import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Static security checks for Customer Portal V1 (no server needed; runs in test:security).
 * Each assertion guards a design rule in docs/technical/CUSTOMER-PORTAL.md.
 */
const files = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => readFileSync(f, "utf8");
const failures = [];
const expect = (ok, message) => ok || failures.push(message);

const SERVER_ONLY = [
  "@/lib/customer/supabase",
  "@/lib/customer/portal",
  "@/lib/supabase-server",
  "@/lib/admin/",
  "@/lib/site-content",
];

for (const file of files) {
  const src = read(file);
  const isClient = /^\s*["']use client["']/.test(src);

  // 1. No Supabase client or server-only module in browser code.
  expect(!/createBrowserClient/.test(src), `${file}: customer auth must stay server-side (no createBrowserClient)`);
  if (isClient) {
    for (const mod of SERVER_ONLY) {
      for (const m of src.matchAll(/from "([^"]+)"/g)) {
        // upload-limits holds plain constants shared with the admin upload input (PR #18).
        if (m[1].startsWith(mod) && m[1] !== "@/lib/admin/upload-limits") {
          failures.push(`${file}: client component imports server-only module ${m[1]}`);
        }
      }
    }
  }

  // 2. The publishable key is read in exactly one place.
  if (src.includes("VELTO_SUPABASE_PUBLISHABLE_KEY")) {
    expect(file === "src/lib/customer/config.ts", `${file}: read VELTO_SUPABASE_PUBLISHABLE_KEY only through customerAuthConfig()`);
  }

  // Account features never depend on a cookie-consent choice.
  if (/^src\/(lib\/customer|components\/account|app\/\(site\)\/account)\//.test(file)) {
    expect(!/@\/lib\/consent|@\/lib\/analytics\/client|readConsent/.test(src), `${file}: account code must not read consent`);
  }

  // 3. Customer-facing code reaches Ops data only through the portal_* functions.
  if (/^src\/(lib\/customer|components\/account|app\/\(site\)\/account)\//.test(file)) {
    expect(!/\.from\(\s*["']/.test(src), `${file}: customer code must not query tables directly (use portal_* RPCs)`);
    for (const m of src.matchAll(/\.rpc\(\s*["']([a-z_]+)["']/g)) {
      expect(m[1].startsWith("portal_") && !["portal_link_decide", "portal_link_requests"].includes(m[1]), `${file}: customer code calls ${m[1]}`);
    }
  }
}

// 4. Session cookies are httpOnly wherever they are written.
for (const file of ["src/lib/customer/supabase.ts", "src/proxy.ts"]) {
  expect(/httpOnly:\s*true/.test(read(file)), `${file}: auth cookies must be httpOnly`);
  expect(/sameSite:\s*"lax"/.test(read(file)), `${file}: auth cookies must be SameSite=Lax`);
}

// 5. The proxy protects the whole account area.
const proxy = read("src/proxy.ts");
// The proxy runs on every page (English and /bn), strips the language prefix, then protects /account.
expect(/const \{ locale, path \} = splitLocale\(url\.pathname\)/.test(proxy), "src/proxy.ts: account protection must apply to the /bn account pages too");
expect(proxy.includes('const protectedRoute = path === "/account" || path.startsWith("/account/");'), "src/proxy.ts: must protect /account and /account/*");
expect(proxy.includes('matcher: ["/((?!api/|admin|go/|auth/|_next/|'), "src/proxy.ts: matcher must cover every page, including /account and /bn/account");
expect(/auth\.getUser\(\)/.test(proxy), "src/proxy.ts: sessions must be verified with getUser()");

// 6. Redirect targets and order URLs are validated.
expect(read("src/app/auth/confirm/route.ts").includes("safeNextPath("), "auth/confirm must validate next= with safeNextPath");
expect(read("src/lib/customer/actions.ts").includes("safeNextPath("), "sign-in must validate next= with safeNextPath");
expect(read("src/app/[lang]/(site)/account/orders/[id]/page.tsx").includes("validOrderNumber("), "order detail must accept order numbers only");

// 7. Consent-first GTM (PR #19's canonical implementation) with the portal privacy guards.
const tracking = read("src/components/layout/TrackingScripts.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
expect(!/<noscript|<iframe/.test(tracking), "TrackingScripts: a noscript GTM iframe would load before consent");
expect(tracking.includes("ConsentGatedTagManager"), "TrackingScripts: GTM must go through the consent gate");
const gate = read("src/components/consent/ConsentGatedTagManager.tsx");
expect(/isPrivatePath\(pathname\)/.test(gate) && /location\.reload\(\)/.test(gate), "ConsentGatedTagManager: GTM must stay off account pages");
expect(/isPrivatePath\(/.test(read("src/components/layout/Analytics.tsx")), "track() must emit nothing on account pages");
expect(/isPrivatePath\(/.test(read("src/lib/analytics/client.ts")), "first-party analytics must skip account pages");
expect(/isPrivatePath\(path\)/.test(read("src/lib/analytics/collect-validation.ts")), "/api/collect must drop account-page events");
expect(!files.includes("src/components/layout/ConsentManager.tsx"), "there is one consent manager (src/components/consent)");

// 8. SQL contract for the portal functions and the identity table.
const sql = read("docs/technical/sql/customer_portal.sql");
for (const m of sql.matchAll(/create or replace function (public\.(?:portal_\w+|cockpit_stats))\([\s\S]*?\nas \$\$/g)) {
  expect(/set search_path = ''/.test(m[0]), `${m[1]}: needs set search_path = ''`);
}
expect(/alter table public\.customer_accounts enable row level security/.test(sql), "customer_accounts must have RLS enabled");
expect(/revoke all on table public\.customer_accounts from public, anon, authenticated/.test(sql), "customer_accounts must not be granted to API roles");
expect(/grant execute on function public\.portal_link_decide\([^)]*\) to service_role;/.test(sql), "portal_link_decide must be service-role only");
expect(!/grant execute on function public\.portal_link_\w+\([^)]*\) to authenticated/.test(sql), "link functions must never be granted to authenticated");
expect(!/grant [^;]* to anon/.test(sql), "portal SQL must not grant anything to anon");
expect(/is_active_staff\(\) and \(%s\)/.test(sql), "Ops policies must be wrapped with is_active_staff()");

assert.deepEqual(failures, [], `Customer portal checks failed:\n${failures.join("\n")}`);
console.log(`Customer portal static checks passed across ${files.length} source files and the portal SQL.`);
