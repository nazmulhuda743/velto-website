import assert from "node:assert/strict";

const base = process.env.LAUNCH_BASE_URL || "http://127.0.0.1:3000";

const routes = [
  "/",
  "/services",
  "/services/dry-cleaning",
  "/services/wash-and-iron",
  "/services/ironing",
  "/services/curtain-cleaning",
  "/services/carpet-cleaning",
  "/services/blanket-comforter-cleaning",
  "/services/express",
  "/regular-laundry",
  "/pricing",
  "/how-it-works",
  "/locations",
  "/locations/sector-11",
  "/locations/sector-18",
  "/about",
  "/book",
  "/quote",
  "/privacy",
  "/terms",
];

async function request(path, init) {
  return fetch(new URL(path, base), { redirect: "manual", ...init });
}

for (const route of routes) {
  const response = await request(route);
  assert.equal(response.status, 200, `${route} returned ${response.status}`);
}

const homeResponse = await request("/");
const home = await homeResponse.text();
assert.match(home, /rel="canonical"/i, "homepage canonical link missing");
assert.ok(home.includes("https://www.velto.com.bd"), "production canonical origin missing");
assert.equal(homeResponse.headers.get("x-content-type-options"), "nosniff");
assert.equal(homeResponse.headers.get("x-frame-options"), "DENY");
assert.equal(homeResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");

const missing = await request("/__launch-audit-missing-page__");
assert.equal(missing.status, 404, `missing route should be 404, got ${missing.status}`);

const robotsResponse = await request("/robots.txt");
assert.equal(robotsResponse.status, 200);
const robots = await robotsResponse.text();
assert.match(robots, /Disallow:\s*\/api\//i, "robots.txt must block API crawling");

const sitemapResponse = await request("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
for (const route of ["/services/dry-cleaning", "/pricing", "/locations/sector-11"]) {
  assert.ok(sitemap.includes(`https://www.velto.com.bd${route}`), `sitemap missing ${route}`);
}

const wrongType = await request("/api/bookings", {
  method: "POST",
  headers: { "content-type": "text/plain" },
  body: "{}",
});
assert.equal(wrongType.status, 415, `booking endpoint should reject non-JSON with 415, got ${wrongType.status}`);

const malformed = await request("/api/quotes", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{",
});
assert.equal(malformed.status, 400, `quote endpoint should reject malformed JSON with 400, got ${malformed.status}`);

const oversized = await request("/api/bookings", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ data: { notes: "x".repeat(40 * 1024) } }),
});
assert.equal(oversized.status, 413, `booking endpoint should reject oversized JSON with 413, got ${oversized.status}`);

console.log(`Launch smoke audit passed for ${routes.length} public routes plus SEO, headers, 404 and API guards.`);
