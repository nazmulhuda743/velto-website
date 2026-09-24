import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { validateCollectBody } from "@/lib/analytics/collect-validation";
import { isAnalyticsWritesEnabled, storeCollected } from "@/lib/analytics/store";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { readBoundedJson } from "@/lib/security/json-request";

/**
 * First-party analytics ingestion (Command Center).
 *
 *   POST { type: "events" | "consent" | "not_found", ... }  →  204
 *
 * - Behavioral events are stored only when the visitor's consent cookie,
 *   read here on the server, grants analytics. The client check is not trusted.
 * - Consent decisions and 404s are stored anonymously (no visitor/session id).
 * - The response is always 204 for well-formed requests, so the browser learns
 *   nothing about storage state; nothing is stored unless
 *   WEBSITE_ANALYTICS_WRITES_ENABLED is "true".
 * - No IP address is stored. A salted hash is kept in memory only, for
 *   per-instance flood control.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

function limited(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = createHash("sha256").update(`velto-collect:${ip}`).digest("base64url").slice(0, 16);
  const now = Date.now();
  if (buckets.size > 5_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === request.headers.get("host");
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

const noContent = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
const reject = (status: number) =>
  NextResponse.json({ ok: false }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reject(403);

  const read = await readBoundedJson(request, 8 * 1024);
  if (!read.ok) return reject(read.status);

  const body = validateCollectBody(read.value);
  if (!body) return reject(400);
  if (limited(request)) return reject(429);

  const consent = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value);
  if (body.type === "events" && !consent?.analytics) return noContent();
  if (!isAnalyticsWritesEnabled()) return noContent();

  try {
    await storeCollected(body, consent?.marketing === true);
  } catch (error) {
    console.error("analytics_collect_failed", error instanceof Error ? error.message : "unknown");
  }
  return noContent();
}
