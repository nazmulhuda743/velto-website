import { NextResponse, type NextRequest } from "next/server";
import { getCapacityConfig, getPickupAvailability } from "@/lib/capacity";

/**
 * Public pickup availability for one sector: the next days and, per window, open / few (with
 * how many are left) / full / closed / past. Only statuses leave the server, never who booked.
 * `enabled: false`: capacity booking is off, and the form works as a preference Velto confirms.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const sector = Number(request.nextUrl.searchParams.get("sector"));
  const config = await getCapacityConfig();
  if (!config.enabled) return NextResponse.json({ enabled: false }, { headers });
  if (!Number.isInteger(sector) || sector < 1 || sector > 18) return NextResponse.json({ enabled: true, zone: null, days: [] }, { headers });
  const availability = await getPickupAvailability(sector);
  if (!availability) return NextResponse.json({ enabled: true, zone: null, days: [], unavailable: true }, { headers, status: 503 });
  return NextResponse.json(availability, { headers });
}
