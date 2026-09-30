import { NextResponse, type NextRequest } from "next/server";
import { handleBooking } from "@/lib/booking-handler";
import { readBoundedJson } from "@/lib/security/json-request";

/** Website-owned booking endpoint (spec §8); the logic lives in lib/booking-handler.ts. */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const body = await readBoundedJson(request);
  if (!body.ok) {
    return NextResponse.json(
      { ok: false as const, error: { code: "invalid_request", requestId, retryable: false } },
      { status: body.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return handleBooking((body.value ?? {}) as Record<string, unknown>, requestId);
}
