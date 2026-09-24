import assert from "node:assert/strict";

const base = process.env.LAUNCH_BASE_URL || "http://127.0.0.1:3000";
const productionOrigin = "https://www.velto.com.bd";

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
    assert.ok(hasIntrinsicSize || isNextFill, `${route} rendered an image without intrinsic dimensions or a valid Next/Image fill box`);
  }
}

for (const route of [
  "/",
  "/services",
  "/services/dry-cleaning",
  "/services/express",
  "/pricing",
  "/locations",
  "/locations/sector-11",
]) {
  const { body } = await html(route);
  const expected = route === "/" ? `${productionOrigin}/` : `${productionOrigin}${route}`;
  assert.match(body, /rel="canonical"/i, `${route} canonical link missing`);
  assert.ok(
    body.includes(`href="${expected}"`) || body.includes(`href="${expected.replace(/\/$/, "")}"`),
    `${route} canonical URL is not ${expected}`,
  );
}

for (const route of ["/book", "/quote", "/privacy", "/terms"]) {
  const { body } = await html(route);
  assert.match(body, /name="robots"[^>]+noindex|noindex[^>]+name="robots"/i, `${route} must be noindex`);
}

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
assert.match(robots, /Disallow:\s*\/api\//i, "robots.txt must block API crawling");

const sitemapResponse = await request("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
const sitemap = await sitemapResponse.text();
for (const route of ["/services/dry-cleaning", "/services/express", "/pricing", "/locations/sector-11"]) {
  assert.ok(sitemap.includes(`${productionOrigin}${route}`), `sitemap missing ${route}`);
}
for (const route of ["/book", "/quote", "/privacy", "/terms"]) {
  assert.ok(!sitemap.includes(`${productionOrigin}${route}`), `sitemap must not include utility route ${route}`);
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

console.log(
  `Launch smoke audit passed for ${routes.length} public routes plus accessibility structure, image stability, canonicals, noindex rules, sitemap, headers, 404 and API guards.`,
);
