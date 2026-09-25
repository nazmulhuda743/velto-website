import { createHash } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { logServerEvent } from "@/lib/analytics/store";
import { readBoundedJson } from "@/lib/security/json-request";
import { isSupabaseConfigured, supabaseRpc } from "@/lib/supabase-server";

export type TrackedOrder = {
  orderNumber: string;
  status: string;
  orderDate: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  promisedAt: string | null;
  deliveredAt: string | null;
  items: number | null;
  services: string[] | null;
  express: boolean | null;
  total: number | null;
  due: number | null;
  paymentStatus: string | null;
};

type RateLimitResult = {
  ok?: unknown;
  allowed?: unknown;
  retry_after_seconds?: unknown;
};

const rateKey = (bucket: "ip" | "order", value: string) =>
  createHash("sha256").update(`${bucket}:${value}`).digest("hex");

function canonicalOrderSubject(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = compact.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits || compact || "invalid";
}

async function checkRateLimit(bucket: "ip" | "order", key: string) {
  const result = await supabaseRpc<RateLimitResult>("website_track_rate_limit", {
    p_bucket: bucket,
    p_rate_key: key,
  });
  if (result.ok !== true || typeof result.allowed !== "boolean") {
    throw new Error("tracking rate limiter returned an invalid response");
  }
  return {
    allowed: result.allowed,
    retryAfter:
      typeof result.retry_after_seconds === "number" &&
      Number.isFinite(result.retry_after_seconds) &&
      result.retry_after_seconds > 0
        ? Math.ceil(result.retry_after_seconds)
        : 0,
  };
}

/** Order status lookup: order number and phone must both match (Velto Ops). */
export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request, 4 * 1024);
  if (!body.ok) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: body.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const input =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as Record<string, unknown>)
      : {};
  const orderNumber =
    typeof input.orderNumber === "string" ? input.orderNumber.trim().slice(0, 32) : "";
  const phone = typeof input.phone === "string" ? input.phone.trim().slice(0, 32) : "";
  if (!orderNumber || !phone) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    // Vercel overwrites x-forwarded-for for normal deployments, so the first
    // value is the requester IP rather than a client-controlled spoofed value.
    // Only a SHA-256 digest is persisted by the database rate limiter.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const [ipLimit, orderLimit] = await Promise.all([
      checkRateLimit("ip", rateKey("ip", ip)),
      checkRateLimit("order", rateKey("order", canonicalOrderSubject(orderNumber))),
    ]);

    if (!ipLimit.allowed || !orderLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfter, orderLimit.retryAfter, 1);
      return NextResponse.json(
        { error: "too_many_attempts" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }

    const result = await supabaseRpc<{ found: boolean; order?: TrackedOrder }>(
      "website_track_order",
      {
        p_order_number: orderNumber,
        p_phone: phone,
      },
    );
    return NextResponse.json(
      result.found && result.order ? { found: true, order: result.order } : { found: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("track_failed", error instanceof Error ? error.message : "unknown");
    after(() => logServerEvent("tracking_error", "/api/track", "unavailable"));
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
