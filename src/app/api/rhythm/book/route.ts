import { NextResponse, type NextRequest } from "next/server";
import { handleBooking } from "@/lib/booking-handler";
import { isWindowId, sectorOf, type WindowId } from "@/lib/capacity-logic";
import { bookingServiceFor } from "@/lib/customer/rhythm";
import { opsPickupWhen } from "@/lib/pickup-when";
import { bookingData, CODE, markBooked } from "@/lib/rhythm-server";
import { readBoundedJson } from "@/lib/security/json-request";

/**
 * "Yes, pick up" on the one-tap reminder page (/r/[code]). The browser sends only the code and
 * the chosen day/window; the name, phone and address come from Velto Ops on the server and go
 * through exactly the same booking path as the booking form (lib/booking-handler.ts). A code
 * books once and expires after 7 days.
 */
const WINDOWS: Record<WindowId, { starts: string; ends: string }> = {
  morning: { starts: "09:00", ends: "12:00" },
  afternoon: { starts: "12:00", ends: "16:00" },
  evening: { starts: "16:00", ends: "20:00" },
  night: { starts: "20:00", ends: "22:00" },
};

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const body = await readBoundedJson(request);
  if (!body.ok) return json({ ok: false, error: { code: "invalid_request", requestId } }, body.status);
  const input = (body.value ?? {}) as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code : "";
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  const windowId = isWindowId(input.window) ? input.window : null;
  const window = windowId ? { id: windowId, ...(input.starts && input.ends && typeof input.starts === "string" && typeof input.ends === "string" && /^\d{2}:\d{2}$/.test(input.starts) && /^\d{2}:\d{2}$/.test(input.ends) ? { starts: input.starts, ends: input.ends } : WINDOWS[windowId]) } : null;
  const live = input.live === true;
  if (!CODE.test(code) || !date || !window) return json({ ok: false, error: { code: "invalid_request", requestId } }, 400);

  const data = await bookingData(code).catch(() => ({ ok: false as const }));
  if (!data.ok) return json({ ok: false, error: { code: "link_closed", requestId } }, 410);

  const address = data.address?.trim() ?? "";
  const sector = sectorOf(address);
  const service = bookingServiceFor(data.service ? [data.service] : []);
  const response = await handleBooking(
    {
      data: {
        name: data.name?.trim() || "Velto customer",
        phone: data.phone,
        area: sector ? `Sector ${sector}, Uttara` : data.zone?.trim() || "Uttara",
        address: address.length >= 5 ? address : "Address on file in Velto Ops",
        preferredPickup: opsPickupWhen(date, window, live),
        ...(service ? { service } : {}),
        ...(live ? { slot: { date, window: window.id } } : {}),
        notes: `Booked in one tap from a Velto reminder (same as last time${data.lastOrder ? `, ${data.lastOrder}` : ""}). Please confirm the time and address by phone.`,
      },
      idempotencyKey: `rhythm-link-${code}`,
    },
    requestId,
  );
  const result = (await response.clone().json().catch(() => null)) as { ok?: boolean; reference?: string } | null;
  if (result?.ok) await markBooked(code, result.reference ?? null).catch(() => null);
  return response;
}
