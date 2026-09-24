import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const EXPECTED_SITE_ORIGIN = "https://www.velto.com.bd";
const EXPECTED_SUPABASE_HOST = "erutxtnepbejdxkoimeo.supabase.co";
const EXPECTED_VIEW = "website_pricing_public";
const EXPECTED_PUBLIC_FINGERPRINT = "1ca4d69df562cf967ab64902cb3f9f30";
const EXPECTED_ROW_COUNTS = {
  total: 534,
  distinctItems: 195,
  poa: 6,
  sqft: 8,
  services: {
    "dry-cleaning": 195,
    ironing: 144,
    "wash-and-iron": 195,
  },
};
const PUBLIC_KEYS = [
  "item_slug",
  "item_name",
  "service_slug",
  "service_name",
  "price_amount_minor",
  "currency",
  "unit_label",
];
const EXPECTED_OPENAPI_PATHS = [
  "/website_content",
  "/rpc/website_create_request",
  "/rpc/website_track_order",
  "/rpc/website_track_rate_limit",
];
const REQUEST_TIMEOUT_MS = 8_000;

const checks = [];
const failures = [];

function pass(message) {
  checks.push(message);
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL ${message}`);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value ?? "";
}

function parseHttpsUrl(name, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("must use https");
    return url;
  } catch {
    fail(`${name} must be a valid HTTPS URL`);
    return null;
  }
}

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function validatePricingRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const keys = Object.keys(row).sort();
  const expectedKeys = [...PUBLIC_KEYS].sort();
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    typeof row.item_slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.item_slug) &&
    typeof row.item_name === "string" &&
    ["dry-cleaning", "wash-and-iron", "ironing"].includes(row.service_slug) &&
    typeof row.service_name === "string" &&
    (row.price_amount_minor === null ||
      (Number.isSafeInteger(row.price_amount_minor) && row.price_amount_minor >= 0)) &&
    row.currency === "BDT" &&
    (row.unit_label === null || row.unit_label === "per sq ft")
  );
}

function publicFingerprint(rows) {
  const lines = [...rows]
    .sort((a, b) =>
      `${a.item_slug}|${a.service_slug}`.localeCompare(`${b.item_slug}|${b.service_slug}`),
    )
    .map((row) =>
      [
        row.item_slug,
        row.item_name,
        row.service_slug,
        row.service_name,
        row.price_amount_minor ?? "",
        row.currency,
        row.unit_label ?? "",
      ].join("|"),
    );
  return createHash("md5").update(lines.join("\n")).digest("hex");
}

function findRow(rows, itemName, serviceSlug) {
  return rows.find(
    (row) => row.item_name === itemName && row.service_slug === serviceSlug,
  );
}

function expectRepresentative(rows, itemName, serviceSlug, amountMinor, unitLabel = null) {
  const row = findRow(rows, itemName, serviceSlug);
  if (!row) {
    fail(`pricing is missing ${itemName} / ${serviceSlug}`);
    return;
  }
  if (row.price_amount_minor !== amountMinor || row.unit_label !== unitLabel) {
    fail(
      `${itemName} / ${serviceSlug} expected amount=${amountMinor} unit=${unitLabel ?? "item"}`,
    );
    return;
  }
  pass(`representative price ${itemName} / ${serviceSlug}`);
}

async function main() {
  const siteValue = required("NEXT_PUBLIC_SITE_URL");
  const supabaseValue = required("VELTO_SUPABASE_URL");
  const secretKey = required("VELTO_SUPABASE_SECRET_KEY");
  const adminSessionSecret = required("ADMIN_SESSION_SECRET");
  const view = required("VELTO_PRICING_VIEW");
  const writes = required("VELTO_OPS_WRITES_ENABLED");

  const siteUrl = parseHttpsUrl("NEXT_PUBLIC_SITE_URL", siteValue);
  const supabaseUrl = parseHttpsUrl("VELTO_SUPABASE_URL", supabaseValue);

  if (siteUrl?.origin === EXPECTED_SITE_ORIGIN) pass("canonical production origin");
  else if (siteUrl) fail(`NEXT_PUBLIC_SITE_URL must be ${EXPECTED_SITE_ORIGIN}`);

  if (supabaseUrl?.hostname === EXPECTED_SUPABASE_HOST) pass("production Supabase project selected");
  else if (supabaseUrl) fail(`VELTO_SUPABASE_URL must target ${EXPECTED_SUPABASE_HOST}`);

  if (view === EXPECTED_VIEW) pass("approved pricing view selected");
  else fail(`VELTO_PRICING_VIEW must be ${EXPECTED_VIEW}`);

  if (writes === "false") pass("Ops writes remain disabled");
  else fail("VELTO_OPS_WRITES_ENABLED must be exactly false during readiness verification");

  if (secretKey.startsWith("sb_secret_") || secretKey.startsWith("eyJ")) {
    pass("server-side Supabase credential format");
  } else {
    fail("VELTO_SUPABASE_SECRET_KEY is not a recognized Supabase secret/service-role key format");
  }

  if (adminSessionSecret.length >= 32 && adminSessionSecret !== secretKey) {
    pass("dedicated admin session signing secret");
  } else if (adminSessionSecret === secretKey) {
    fail("ADMIN_SESSION_SECRET must be independent from VELTO_SUPABASE_SECRET_KEY");
  } else {
    fail("ADMIN_SESSION_SECRET must be a long dedicated production secret (at least 32 characters)");
  }

  const gtm = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (!gtm) {
    console.log("INFO NEXT_PUBLIC_GTM_ID is optional and not configured in this process");
  } else if (/^GTM-[A-Z0-9]+$/i.test(gtm)) {
    pass("GTM ID syntax");
  } else {
    fail("NEXT_PUBLIC_GTM_ID is set but does not look like a GTM container ID");
  }

  if (!supabaseUrl || !secretKey || failures.length) {
    throw new Error("configuration checks failed before any network verification");
  }

  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    Accept: "application/json",
  };

  const pricingUrl = new URL(`/rest/v1/${view}`, supabaseUrl);
  pricingUrl.searchParams.set("select", PUBLIC_KEYS.join(","));
  pricingUrl.searchParams.set("order", "item_slug.asc,service_slug.asc");
  pricingUrl.searchParams.set("limit", "1000");

  const pricingResponse = await fetchWithTimeout(pricingUrl, { headers, cache: "no-store" });
  if (!pricingResponse.ok) {
    fail(`Supabase pricing view returned HTTP ${pricingResponse.status}`);
    throw new Error("production pricing view is not reachable");
  }
  pass("Supabase endpoint and pricing view reachable");

  const rows = await pricingResponse.json();
  if (!Array.isArray(rows) || !rows.every(validatePricingRow)) {
    fail("pricing view payload does not match the seven-field public contract");
    throw new Error("pricing contract mismatch");
  }
  pass("pricing public shape");

  const serviceCounts = Object.fromEntries(
    Object.keys(EXPECTED_ROW_COUNTS.services).map((slug) => [
      slug,
      rows.filter((row) => row.service_slug === slug).length,
    ]),
  );
  const distinctItems = new Set(rows.map((row) => row.item_slug)).size;
  const poaCount = rows.filter((row) => row.price_amount_minor === null).length;
  const sqftCount = rows.filter((row) => row.unit_label === "per sq ft").length;
  const pairKeys = rows.map((row) => `${row.item_slug}|${row.service_slug}`);

  if (rows.length === EXPECTED_ROW_COUNTS.total) pass(`pricing row count ${rows.length}`);
  else fail(`pricing row count expected ${EXPECTED_ROW_COUNTS.total}, got ${rows.length}`);

  if (distinctItems === EXPECTED_ROW_COUNTS.distinctItems) pass(`distinct item count ${distinctItems}`);
  else fail(`distinct item count expected ${EXPECTED_ROW_COUNTS.distinctItems}, got ${distinctItems}`);

  if (poaCount === EXPECTED_ROW_COUNTS.poa) pass(`POA row count ${poaCount}`);
  else fail(`POA row count expected ${EXPECTED_ROW_COUNTS.poa}, got ${poaCount}`);

  if (sqftCount === EXPECTED_ROW_COUNTS.sqft) pass(`per-square-foot row count ${sqftCount}`);
  else fail(`per-square-foot row count expected ${EXPECTED_ROW_COUNTS.sqft}, got ${sqftCount}`);

  if (new Set(pairKeys).size === pairKeys.length) pass("stable unique item/service slug pairs");
  else fail("duplicate item/service slug pair detected");

  for (const [slug, expected] of Object.entries(EXPECTED_ROW_COUNTS.services)) {
    if (serviceCounts[slug] === expected) pass(`${slug} row count ${expected}`);
    else fail(`${slug} row count expected ${expected}, got ${serviceCounts[slug]}`);
  }

  const fingerprint = publicFingerprint(rows);
  if (fingerprint === EXPECTED_PUBLIC_FINGERPRINT) pass("approved public pricing fingerprint");
  else fail(`public pricing fingerprint changed: ${fingerprint}`);

  expectRepresentative(rows, "Blazer", "dry-cleaning", 25000);
  expectRepresentative(rows, "Blazer", "ironing", 10000);
  expectRepresentative(rows, "Blazer", "wash-and-iron", 22000);
  expectRepresentative(rows, "Curtain Normal (per sqft)", "dry-cleaning", 800, "per sq ft");
  expectRepresentative(rows, "Carpet (per sqft)", "dry-cleaning", 5000, "per sq ft");
  expectRepresentative(rows, "Comforter (Regular)", "dry-cleaning", 40000);
  expectRepresentative(rows, "Comforter (Heavy)", "wash-and-iron", 50000);
  expectRepresentative(rows, "Blanket (Regular/Medium)", "wash-and-iron", 40000);

  const openApiResponse = await fetchWithTimeout(new URL("/rest/v1/", supabaseUrl), {
    headers: { ...headers, Accept: "application/openapi+json" },
    cache: "no-store",
  });
  if (!openApiResponse.ok) {
    fail(`Supabase OpenAPI inspection returned HTTP ${openApiResponse.status}`);
  } else {
    const spec = await openApiResponse.json();
    const paths = spec?.paths && typeof spec.paths === "object" ? Object.keys(spec.paths) : [];
    for (const expectedPath of EXPECTED_OPENAPI_PATHS) {
      if (paths.includes(expectedPath)) pass(`${expectedPath} detectable in Supabase OpenAPI`);
      else fail(`${expectedPath} is not present in the Supabase OpenAPI contract`);
    }
  }

  if (!siteUrl) throw new Error("site URL is invalid");

  const homeResponse = await fetchWithTimeout(siteUrl, { cache: "no-store" });
  if (!homeResponse.ok) {
    fail(`production homepage returned HTTP ${homeResponse.status}`);
  } else {
    const html = await homeResponse.text();
    const canonicalTags = html.match(/<link\b[^>]*>/gi) ?? [];
    const hasExpectedCanonical = canonicalTags.some((tag) => {
      const rel = tag.match(/\brel=["']([^"']*)["']/i)?.[1]?.toLowerCase() ?? "";
      const href = tag.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? "";
      if (!rel.split(/\s+/).includes("canonical")) return false;
      try {
        return new URL(href, siteUrl).toString().replace(/\/$/, "") === EXPECTED_SITE_ORIGIN;
      } catch {
        return false;
      }
    });
    if (hasExpectedCanonical) pass("production homepage canonical");
    else fail("production homepage does not expose the expected canonical URL");
  }

  const publicPriceApi = new URL("/api/prices?q=Blazer", siteUrl);
  const publicPriceResponse = await fetchWithTimeout(publicPriceApi, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!publicPriceResponse.ok) {
    fail(`public /api/prices returned HTTP ${publicPriceResponse.status}`);
  } else {
    const body = await publicPriceResponse.json().catch(() => null);
    assert.ok(body && typeof body === "object", "public /api/prices must return JSON");
    if (body.source === "live") pass("public /api/prices reports live source");
    else fail(`public /api/prices source is ${String(body.source)}`);

    const blazer = Array.isArray(body.items)
      ? body.items.find((item) => item?.name === "Blazer")
      : null;
    if (blazer) pass("public /api/prices returns representative live item");
    else fail("public /api/prices did not return Blazer");
  }

  if (failures.length) {
    console.error(`\nProduction readiness FAILED with ${failures.length} issue(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nProduction readiness PASS (${checks.length} checks). No write request was sent.`);
}

main().catch((error) => {
  if (!failures.length) console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
