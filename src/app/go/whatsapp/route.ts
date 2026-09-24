import { NextResponse, type NextRequest } from "next/server";
import { getSiteContent } from "@/lib/site-content";

/** Every WhatsApp button points here, so the number is managed from the admin dashboard. */
export async function GET(request: NextRequest) {
  const { settings } = await getSiteContent();
  const target = new URL(`https://wa.me/${settings.whatsappNumber}`);
  const text = request.nextUrl.searchParams.get("text");
  if (text) target.searchParams.set("text", text.slice(0, 500));
  return NextResponse.redirect(target, 302);
}
