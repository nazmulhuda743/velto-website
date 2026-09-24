import assert from "node:assert/strict";

const base = process.env.LAUNCH_BASE_URL || "http://127.0.0.1:3000";
const productionOrigin = "https://www.velto.com.bd";

const routes = [
  "/", "/services", "/services/dry-cleaning", "/services/wash-and-iron", "/services/ironing",
  "/services/curtain-cleaning", "/services/carpet-cleaning", "/services/blanket-comforter-cleaning",
  "/services/express", "/regular-laundry", "/pricing", "/how-it-works", "/locations",
  "/locations/sector-11", "/locations/sector-18", "/about", "/track", "/book", "/quote",
  "/privacy", "/terms",
];

async function request(path, init) {
  return fetch(new URL(path, base), { redirect: "manual", ...init });
}

async function html(path) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return { response, body: await response.text() };
}

for (const route of routes) {
  const { body } = await html(route);
  assert.match(body, /<html[^>]+lang="en"/i, `${route} is missing html lang=en`);
  assert.match(body, /<main[^>]+id="main"/i, `${route} is missing the primary main landmark`);
  assert.match(body, /<h1\b/i, `${route} is missing an H1`);
  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    const image = match[0];
    assert.match(image, /\balt="[^"]*"/i, `${route} rendered an image without alt text`);
    const hasIntrinsicSize = /\bwidth="\d+"/i.test(image) && /\bheight="\d+"/i.test(image);
    const isNextFill = /\bdata-nimg="fill"/i.test(image) && /style="[^"]*height:100%;width:100%/i.test(image);
    assert.ok(hasIntrinsicSize || isNextFill, `${route} rendered an unstable image`);
  }
}

for (const route of ["/","/services","/services/dry-cleaning","/services/express","/pricing","/locations","/locations/sector-11","/track"]) {
  const { body } = await html(route);
  const expected = route === "/" ? `${productionOrigin}/` : `${productionOrigin}${route}`;
  assert.match(body, /rel="canonical"/i, `${route} canonical missing`);
  assert.ok(body.includes(`href="${expected}"`) || body.includes(`href="${expected.replace(/\/$/, "")}"`), `${route} canonical mismatch`);
}

for (const route of ["/book", "/quote", "/track", "/privacy", "/terms"]) {
  const { body } = await html(route);
  assert.match(body, /name="robots"[^>]+noindex|noindex[^>]+name="robots"/i, `${route} must be noindex`);
}

const adminLogin = await html("/admin/login");
assert.match(adminLogin.body, /name="robots"[^>]+noindex|noindex[^>]+name="robots"/i, "/admin/login must be noindex");

const homeResponse = await request("/");
assert.equal(homeResponse.headers.get("x-content-type-options"), "nosniff");
assert.equal(homeResponse.headers.get("x-frame-options"), "DENY");
assert.equal(homeResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
assert.match(homeResponse.headers.get("permissions-policy") ?? "", /microphone=\(\)/, "Permissions-Policy missing microphone restriction");

const missing = await request("/__launch-audit-missing-page__");
assert.equal(missing.status, 404, `missing route should be 404, got ${missing.status}`);

const robotsResponse = await request("/robots.txt");
assert.equal(robotsResponse.status, 200);
const robots = await robotsResponse.text();
for (const blocked of ["/api/", "/admin", "/go/"]) assert.match(robots, new RegExp(`Disallow:\\s*${blocked.replace("/", "\\/")}`, "i"), `robots.txt must block ${blocked}`);

const sitemapResponse = await request("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
for (const route of ["/services/dry-cleaning", "/services/express", "/pricing", "/locations/sector-11"]) {
  assert.ok(sitemap.includes(`${productionOrigin}${route}`), `sitemap missing ${route}`);
}
for (const route of ["/book", "/quote", "/track", "/privacy", "/terms", "/admin"]) {
  assert.ok(!sitemap.includes(`${productionOrigin}${route}`), `sitemap must not include ${route}`);
}

const dryCleaning = await html("/services/dry-cleaning");
assert.match(dryCleaning.body, /"@type":"Service"/, "service page must expose Service schema");
assert.match(dryCleaning.body, /"@type":"BreadcrumbList"/, "service page must expose BreadcrumbList schema");
const location = await html("/locations/sector-11");
assert.match(location.body, /"@type":"LaundryService"/, "location page must expose LaundryService schema");
assert.match(location.body, /"@type":"BreadcrumbList"/, "location page must expose BreadcrumbList schema");

const redirects = new Map([
  ["/about-us", "/about"], ["/contact", "/locations"], ["/checkout", "/book"], ["/team", "/about"],
  ["/services/mens-item", "/services"], ["/services/ladies-item", "/services"],
  ["/services/house-hold-item", "/services"], ["/services/special-item", "/services"],
]);
for (const [from, to] of redirects) {
  const response = await request(from);
  assert.ok([301,302,307,308].includes(response.status), `${from} must redirect, got ${response.status}`);
  const locationHeader = response.headers.get("location");
  assert.ok(locationHeader && new URL(locationHeader, base).pathname === to, `${from} must redirect to ${to}`);
}

const wrongType = await request("/api/bookings", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
assert.equal(wrongType.status, 415, `booking endpoint non-JSON guard got ${wrongType.status}`);
const malformed = await request("/api/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
assert.equal(malformed.status, 400, `quote endpoint malformed JSON guard got ${malformed.status}`);
const oversized = await request("/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { notes: "x".repeat(40 * 1024) } }) });
assert.equal(oversized.status, 413, `booking oversized guard got ${oversized.status}`);

const trackWrongType = await request("/api/track", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
assert.equal(trackWrongType.status, 415, `tracking non-JSON guard got ${trackWrongType.status}`);
const trackMalformed = await request("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
assert.equal(trackMalformed.status, 400, `tracking malformed JSON guard got ${trackMalformed.status}`);
const trackOversized = await request("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber: "VEL-00001", phone: `017${"0".repeat(5000)}` }) });
assert.equal(trackOversized.status, 413, `tracking oversized guard got ${trackOversized.status}`);

const prices = await request("/api/prices?q=Blazer");
assert.ok([200,503].includes(prices.status), `pricing API unexpected status ${prices.status}`);
if (prices.status === 200) {
  const body = await prices.json();
  assert.ok(body.source === "live" || body.source === "mock", "pricing API must identify source");
  assert.ok(Array.isArray(body.items), "pricing API items must be an array");
}

const health = await request("/api/health");
assert.ok([200,503].includes(health.status), `health endpoint unexpected status ${health.status}`);
const healthBody = await health.json();
assert.ok(healthBody.status === "ok" || healthBody.status === "degraded", "health endpoint status contract");
assert.ok(!JSON.stringify(healthBody).includes("supabase.co"), "health endpoint must not expose Supabase origin");

console.log(`Launch smoke V2 passed for ${routes.length} public routes plus SEO, redirects, schema, headers, 404, API guards, admin noindex and health.`);
