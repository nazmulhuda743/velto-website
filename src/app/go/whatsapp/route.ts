import { NextResponse, type NextRequest } from "next/server";
import { getSiteContent } from "@/lib/site-content";
import { composeWhatsAppText, readRefRequest } from "@/lib/whatsapp-ref";
import { createWhatsAppRef } from "@/lib/whatsapp-ref-server";

/**
 * Every WhatsApp button points here, so the number is managed from the admin dashboard.
 *
 * A click on a public page also asks for a WhatsApp reference (src/lib/whatsapp-ref.ts): the
 * campaign context is stored server-side and "Ref: WA-XXXXX" is added to the pre-filled message,
 * so the eventual order can be traced back to the ad. Only a same-site browser navigation gets a
 * reference (crawlers and pasted links don't), and any failure simply sends the plain link.
 */
export async function GET(request: NextRequest) {
  const [{ settings }, ref] = await Promise.all([getSiteContent(), referenceFor(request)]);
  const target = new URL(`https://wa.me/${settings.whatsappNumber}`);
  const text = composeWhatsAppText(request.nextUrl.searchParams.get("text"), ref);
  if (text) target.searchParams.set("text", text);
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

async function referenceFor(request: NextRequest): Promise<string | null> {
  const ask = readRefRequest(request.nextUrl.searchParams);
  if (!ask) return null;
  // Browsers send Sec-Fetch-Site; a reference is only made for a navigation that came from this site.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return null;
  return createWhatsAppRef(ask, request.cookies);
}
