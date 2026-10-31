import { NextResponse, type NextRequest } from "next/server";
import { b999PricesOk, b999WritesEnabled, bookB999, readB999Input } from "@/lib/campaigns/b999-server";
import { readBoundedJson } from "@/lib/security/json-request";

/**
 * The B999 blanket package booking (/blanket-cleaning-uttara). Separate from /api/bookings on
 * purpose: it never looks up the first-order 10% or a coupon, and it ignores any price, quantity
 * or service the browser sends. The offer, the daily cap and the staff note are enforced in
 * website_b999_book; the booking still becomes the same Ops pickup task as every website booking.
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const KEY = /^[A-Za-z0-9._:-]{16,128}$/;

export async function POST(request: NextRequest) {
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ ok: false, error: "invalid" }, body.status);
  const o = (body.value ?? {}) as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : {};
  const key = typeof o.idempotencyKey === "string" && KEY.test(o.idempotencyKey) ? o.idempotencyKey : null;
  if (!key) return json({ ok: false, error: "invalid" }, 400);

  const input = readB999Input(data);
  if (!input.ok) return "outside" in input ? json({ ok: false, error: "outside_area" }, 400) : json({ ok: false, error: "invalid", field: input.field }, 400);
  if (!b999WritesEnabled()) return json({ ok: false, error: "closed" }, 501);
  try {
    // The package is only offered while the live price list still says ৳400 / ৳450.
    if (!(await b999PricesOk())) return json({ ok: false, error: "closed" }, 409);
    const r = await bookB999(`b999:${key}`, input.value, data.attribution);
    if (r.ok) return json(r);
    const status = r.error === "day_full" ? 409 : r.error === "rate_limited" ? 429 : 400;
    return json(r, status);
  } catch {
    return json({ ok: false, error: "unavailable" }, 503);
  }
}
