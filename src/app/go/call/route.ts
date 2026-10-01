import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/site-content";

/** "Call Velto" (notification buttons): the phone's dialer with Velto's number from the admin settings. */
export async function GET() {
  const { settings } = await getSiteContent();
  return new NextResponse(null, { status: 302, headers: { Location: `tel:+${settings.whatsappNumber}`, "Cache-Control": "no-store" } });
}
