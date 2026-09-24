import { NextResponse, type NextRequest } from "next/server";
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

// Best-effort brake on guessing; each serverless instance keeps its own window.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const attempts = new Map<string, number[]>();

function limited(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) attempts.clear();
  return recent.length > MAX_ATTEMPTS;
}

/** Order status lookup: order number and phone must both match (Velto Ops). */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  let body: { orderNumber?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim().slice(0, 32) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 32) : "";
  if (!orderNumber || !phone) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  try {
    const result = await supabaseRpc<{ found: boolean; order?: TrackedOrder }>("website_track_order", {
      p_order_number: orderNumber,
      p_phone: phone,
    });
    return NextResponse.json(result.found && result.order ? { found: true, order: result.order } : { found: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("track_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
