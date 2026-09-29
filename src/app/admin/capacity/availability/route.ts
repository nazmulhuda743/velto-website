import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/admin/permissions";
import { isAdminPreview } from "@/lib/admin/preview";
import { getAdmin } from "@/lib/admin/session";
import { addDaysIso } from "@/lib/capacity-logic";
import { getPickupAvailability } from "@/lib/capacity";

/**
 * Pickup availability for staff booking a customer from WhatsApp or the phone: the same numbers
 * the website shows, but always live (staff book through capacity even before the website switch
 * is on). Signed-in staff with the Capacity section only.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const admin = await getAdmin();
  if (!admin || !can(admin.role, "capacity")) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const sector = Number(request.nextUrl.searchParams.get("sector"));
  if (!Number.isInteger(sector) || sector < 1 || sector > 18) return NextResponse.json({ enabled: true, zone: null, days: [] }, { headers });
  if (isAdminPreview()) {
    const today = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
    const w = (id: string, starts: string, ends: string, status: string, left: number) => ({ id, starts, ends, status, left });
    return NextResponse.json(
      {
        enabled: true,
        zone: "s9-12",
        today,
        days: Array.from({ length: 7 }, (_, i) => ({
          date: addDaysIso(today, i),
          windows: [
            w("morning", "09:00", "12:00", i === 0 ? "past" : i === 1 ? "full" : "open", i === 1 ? 0 : 6),
            w("afternoon", "12:00", "16:00", i === 1 ? "few" : "open", i === 1 ? 2 : 6),
            w("evening", "16:00", "20:00", "open", 7),
          ],
        })),
      },
      { headers },
    );
  }
  const availability = await getPickupAvailability(sector);
  if (!availability) return NextResponse.json({ enabled: true, zone: null, days: [], unavailable: true }, { headers, status: 503 });
  return NextResponse.json({ ...availability, enabled: true }, { headers });
}
