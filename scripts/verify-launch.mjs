import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const EXPECTED_ORIGIN = "https://www.velto.com.bd";
const EXPECTED_HOST = "erutxtnepbejdxkoimeo.supabase.co";
const EXPECTED_VIEW = "website_pricing_public";
const EXPECTED_FINGERPRINT = "1ca4d69df562cf967ab64902cb3f9f30";
const TIMEOUT = 10_000;

const PUBLIC_ROUTES = [
  "/", "/services", "/services/dry-cleaning", "/services/wash-and-iron",
  "/services/ironing", "/services/curtain-cleaning", "/services/carpet-cleaning",
  "/services/blanket-comforter-cleaning", "/services/express", "/pricing",
  "/regular-laundry", "/how-it-works", "/locations", "/locations/sector-11",
  "/locations/sector-18", "/about", "/book", "/quote", "/track", "/privacy", "/terms",
];
const NOINDEX = new Set(["/book", "/quote", "/track", "/privacy", "/terms"]);
const PUBLIC_KEYS = ["item_slug","item_name","service_slug","service_name","price_amount_minor","currency","unit_label"];

const failures = [];
const passes = [];
const pass = (m) => { passes.push(m); console.log(`PASS ${m}`); };
const fail = (m) => { failures.push(m); console.error(`FAIL ${m}`); };
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value || "";
};
const fetchSafe = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });

function parseHttps(name, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error();
    return url;
  } catch {
    fail(`${name} must be a valid HTTPS URL`);
    return null;
  }
}

function fingerprint(rows) {
  const body = [...rows]
    .sort((a,b) => `${a.item_slug}|${a.service_slug}`.localeCompare(`${b.item_slug}|${b.service_slug}`))
    .map((r) => [r.item_slug,r.item_name,r.service_slug,r.service_name,r.price_amount_minor ?? "",r.currency,r.unit_label ?? ""].join("|"))
    .join("\n");
  return createHash("md5").update(body).digest("hex");
}

function hasNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)
    || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(html);
}

function canonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = tag.match(/\brel=["']([^"']*)["']/i)?.[1]?.toLowerCase() || "";
    const href = tag.match(/\bhref=["']([^"']*)["']/i)?.[1];
    if (href && rel.split(/\s+/).includes("canonical")) return href;
  }
  return null;
}

async function main() {
  const siteRaw = required("NEXT_PUBLIC_SITE_URL");
  const supabaseRaw = required("VELTO_SUPABASE_URL");
  const secret = required("VELTO_SUPABASE_SECRET_KEY");
  const view = required("VELTO_PRICING_VIEW");
  const writes = required("VELTO_OPS_WRITES_ENABLED");
  const adminSecret = required("ADMIN_SESSION_SECRET");
  const site = parseHttps("NEXT_PUBLIC_SITE_URL", siteRaw);
  const supabase = parseHttps("VELTO_SUPABASE_URL", supabaseRaw);

  if (site?.origin === EXPECTED_ORIGIN) pass("canonical production origin configured");
  else if (site) fail(`NEXT_PUBLIC_SITE_URL must be ${EXPECTED_ORIGIN}`);
  if (supabase?.hostname === EXPECTED_HOST) pass("production Supabase selected");
  else if (supabase) fail(`VELTO_SUPABASE_URL must target ${EXPECTED_HOST}`);
  if (view === EXPECTED_VIEW) pass("approved pricing view configured"); else fail(`VELTO_PRICING_VIEW must be ${EXPECTED_VIEW}`);
  if (writes === "false") pass("Ops writes are disabled for launch verification"); else fail("VELTO_OPS_WRITES_ENABLED must be exactly false");
  if (adminSecret.length >= 32 && adminSecret !== secret) pass("dedicated admin session secret configured");
  else fail("ADMIN_SESSION_SECRET must be independent and at least 32 characters");
  if (!(secret.startsWith("sb_secret_") || secret.startsWith("eyJ"))) fail("Supabase server credential format is not recognized");
  else pass("server-only Supabase credential present");

  const gtm = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (!gtm) console.log("INFO GTM is not configured");
  else if (/^GTM-[A-Z0-9]+$/i.test(gtm)) pass("GTM ID syntax");
  else fail("NEXT_PUBLIC_GTM_ID is malformed");

  if (!site || !supabase || failures.length) throw new Error("configuration preflight failed");
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, Accept: "application/json" };

  // Direct, read-only pricing contract.
  const pricingUrl = new URL(`/rest/v1/${view}`, supabase);
  pricingUrl.searchParams.set("select", PUBLIC_KEYS.join(","));
  pricingUrl.searchParams.set("order", "item_slug.asc,service_slug.asc");
  pricingUrl.searchParams.set("limit", "1000");
  const pricingRes = await fetchSafe(pricingUrl, { headers });
  if (!pricingRes.ok) throw new Error(`pricing view HTTP ${pricingRes.status}`);
  const rows = await pricingRes.json();
  if (Array.isArray(rows) && rows.length === 534) pass("pricing view has 534 rows"); else fail("pricing view row count changed");
  if (Array.isArray(rows) && fingerprint(rows) === EXPECTED_FINGERPRINT) pass("approved pricing fingerprint"); else fail("pricing fingerprint changed");

  // Read-only launch-state RPC. It is declared STABLE and performs catalog SELECTs only.
  const stateRes = await fetchSafe(new URL("/rest/v1/rpc/website_launch_state", supabase), { headers });
  if (!stateRes.ok) throw new Error(`website_launch_state HTTP ${stateRes.status}`);
  const state = await stateRes.json();
  const expectedTrue = [
    "pricing_view","website_content","tracking_limiter_table","tasks_dedupe_index",
    "pricing_service_select","content_service_select","content_service_insert",
    "create_request_service_execute","track_order_service_execute","track_limit_service_execute","website_media",
  ];
  const expectedFalse = [
    "pricing_anon_select","pricing_authenticated_select","content_anon_select",
    "limiter_service_direct_select","create_request_anon_execute","track_order_anon_execute","track_limit_anon_execute",
  ];
  for (const key of expectedTrue) state?.[key] === true ? pass(`DB launch state ${key}`) : fail(`DB launch state ${key} expected true`);
  for (const key of expectedFalse) state?.[key] === false ? pass(`DB launch state ${key}=false`) : fail(`DB launch state ${key} expected false`);
  for (const key of ["create_request_search_path","track_order_search_path","track_limit_search_path"]) {
    const values = Array.isArray(state?.[key]) ? state[key].join(",") : "";
    if (values.includes("search_path=pg_catalog, public")) pass(`${key} hardened`); else fail(`${key} is not pg_catalog, public`);
  }

  // Domain and route checks. Node's fetch validates TLS.
  const root = await fetchSafe(new URL("/", site), { redirect: "manual" });
  if (root.status === 200) pass("www production HTTPS responds 200"); else fail(`www production root returned ${root.status}`);
  const bare = await fetchSafe("https://velto.com.bd/", { redirect: "manual" });
  const bareLocation = bare.headers.get("location");
  if ([301,302,307,308].includes(bare.status) && bareLocation && new URL(bareLocation, "https://velto.com.bd").origin === EXPECTED_ORIGIN) {
    pass("non-www deliberately redirects to www");
  } else fail(`non-www redirect is not the reviewed www canonical (${bare.status})`);

  for (const route of PUBLIC_ROUTES) {
    const res = await fetchSafe(new URL(route, site), { redirect: "manual" });
    if (res.status !== 200) { fail(`${route} returned ${res.status}`); continue; }
    const html = await res.text();
    const titleOk = /<title>[^<]+<\/title>/i.test(html);
    const descriptionOk = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i.test(html)
      || /<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i.test(html);
    if (titleOk && descriptionOk) pass(`${route} title + description`); else fail(`${route} metadata incomplete`);
    const expected = route === "/" ? `${EXPECTED_ORIGIN}/` : `${EXPECTED_ORIGIN}${route}`;
    const actualCanonical = canonical(html);
    if (actualCanonical && new URL(actualCanonical, site).toString().replace(/\/$/, "") === expected.replace(/\/$/, "")) pass(`${route} canonical`);
    else fail(`${route} canonical mismatch`);
    if (NOINDEX.has(route)) {
      if (hasNoindex(html)) pass(`${route} intentional noindex`); else fail(`${route} must be noindex`);
    } else if (hasNoindex(html)) fail(`${route} is accidentally noindex`); else pass(`${route} indexable`);
    if (!NOINDEX.has(route) && !/property=["']og:title["']/i.test(html)) fail(`${route} missing Open Graph title`);
  }

  const admin = await fetchSafe(new URL("/admin/login", site), { redirect: "manual" });
  if (admin.status === 200 && hasNoindex(await admin.text())) pass("admin login is noindex"); else fail("admin login noindex check failed");

  const robots = await (await fetchSafe(new URL("/robots.txt", site))).text();
  for (const blocked of ["/api/","/admin","/go/"]) {
    if (robots.includes(`Disallow: ${blocked}`)) pass(`robots blocks ${blocked}`); else fail(`robots missing ${blocked}`);
  }
  const sitemap = await (await fetchSafe(new URL("/sitemap.xml", site))).text();
  if (sitemap.includes(`${EXPECTED_ORIGIN}/services/dry-cleaning`) && !sitemap.includes(`${EXPECTED_ORIGIN}/track`)) pass("sitemap inclusion/exclusion contract");
  else fail("sitemap contract failed");

  const livePrices = await fetchSafe(new URL("/api/prices?q=Blazer", site), { headers: { Accept: "application/json" } });
  const liveBody = await livePrices.json().catch(() => null);
  if (livePrices.status === 200 && liveBody?.source === "live") pass("public pricing API is live"); else fail(`public pricing API is not live (${livePrices.status})`);

  // Mutation endpoints receive requests that are rejected before any gateway/RPC call.
  for (const endpoint of ["/api/bookings","/api/quotes","/api/track"]) {
    const res = await fetchSafe(new URL(endpoint, site), { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    if (res.status === 415) pass(`${endpoint} rejects non-JSON before mutation path`); else fail(`${endpoint} non-JSON guard returned ${res.status}`);
  }

  const health = await fetchSafe(new URL("/api/health", site));
  const healthBody = await health.json().catch(() => null);
  if (health.status === 200 && healthBody?.status === "ok" && healthBody?.dependencies?.database === "ok" && healthBody?.dependencies?.pricing === "ok") pass("health endpoint dependencies ok");
  else fail(`health endpoint is not healthy (${health.status})`);
  assert.equal(JSON.stringify(healthBody).includes(EXPECTED_HOST), false, "health endpoint must not expose Supabase host");

  if (failures.length) {
    console.error(`\nLAUNCH VERIFY FAILED: ${failures.length} issue(s). No production mutation was sent.`);
    process.exitCode = 1;
  } else {
    console.log(`\nLAUNCH VERIFY PASS: ${passes.length} checks. No production mutation was sent.`);
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
