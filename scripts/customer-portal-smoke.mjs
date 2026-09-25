import assert from "node:assert/strict";

/**
 * Customer portal and cookie-consent smoke checks against a running server. Works whether
 * customer accounts are enabled or not (CI runs with them disabled).
 */
const base = process.env.LAUNCH_BASE_URL || "http://127.0.0.1:3000";
const request = (path, init) => fetch(new URL(path, base), { redirect: "manual", ...init });

for (const route of ["/login", "/signup", "/forgot-password", "/reset-password", "/cookies"]) {
  const response = await request(route);
  assert.equal(response.status, 200, `${route} returned ${response.status}`);
  const body = await response.text();
  assert.match(body, /<main[^>]+id="main"/i, `${route} is missing the main landmark`);
  assert.match(body, /<h1\b/i, `${route} is missing an H1`);
  assert.match(body, /name="robots"[^>]+noindex|noindex[^>]+name="robots"/i, `${route} must be noindex`);
}

// Account pages never render without a verified session; order URLs are no exception.
for (const route of ["/account", "/account/orders", "/account/orders/VEL-00001", "/account/profile"]) {
  const response = await request(route);
  assert.ok([302, 303, 307, 308].includes(response.status), `${route} should redirect when signed out, got ${response.status}`);
  assert.match(response.headers.get("location") ?? "", /\/login/, `${route} should redirect to /login`);
}

// Email-link landing without a token must fail closed, not 500.
const confirm = await request("/auth/confirm");
assert.ok([302, 303, 307, 308].includes(confirm.status), `/auth/confirm without a token should redirect, got ${confirm.status}`);

// Open redirects: a hostile ?next= must not leave the site.
const login = await (await request("/login?next=https%3A%2F%2Fevil.example%2F")).text();
assert.ok(!login.includes('value="https://evil.example/"'), "login must not carry an external next= destination");

const robots = await (await request("/robots.txt")).text();
assert.match(robots, /Disallow:\s*\/account/i, "robots.txt must block the account area");

const sitemap = await (await request("/sitemap.xml")).text();
for (const route of ["/account", "/login", "/signup", "/reset-password"]) {
  assert.ok(!sitemap.includes(`${route}<`), `sitemap must not include ${route}`);
}

// Consent-first GTM: no tag manager script or noscript iframe in the initial HTML.
const home = await (await request("/")).text();
assert.ok(!/<script[^>]+src="https:\/\/www\.googletagmanager\.com/i.test(home), "GTM must not be requested before consent");
assert.ok(!/<noscript>\s*<iframe[^>]+googletagmanager/i.test(home), "GTM noscript iframe would bypass consent");

const footer = home.match(/<footer[\s\S]*<\/footer>/i)?.[0] ?? "";
assert.match(footer, /Cookie settings/i, "footer must offer Cookie settings");
assert.equal((footer.match(/Cookie settings/gi) ?? []).length, 1, "footer must have exactly one Cookie settings control");
assert.match(footer, /href="\/cookies"/, "footer must link to /cookies");

console.log("Customer portal smoke passed: auth pages, protected account routes, email-link and redirect guards, robots/sitemap and consent-first GTM.");
