import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE } from "@/lib/i18n/config";
import { getSiteContent } from "@/lib/site-content";
import { createWhatsAppRef, withReference } from "@/lib/whatsapp-ref";

/**
 * Every WhatsApp button points here, so the number is managed from the admin dashboard.
 *
 * A tap from a public page arrives with `wr=1` and its campaign context (Analytics.tsx). When
 * VELTO_WHATSAPP_REFS_ENABLED is on, the tap is recorded as a WhatsApp lead and "Ref: W7K2PQ" is
 * added to the prefilled message (lib/whatsapp-ref.ts). Anything else opens WhatsApp unchanged.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const [{ settings }, reference] = await Promise.all([
    getSiteContent(),
    createWhatsAppRef(params, request.cookies, request.headers.get("user-agent")),
  ]);
  const target = new URL(`https://wa.me/${settings.whatsappNumber}`);
  const text = params.get("text");
  if (reference) {
    const locale = params.get("lang") === "bn" || request.cookies.get(LANG_COOKIE)?.value === "bn" ? "bn" : "en";
    target.searchParams.set("text", withReference(text, reference, locale));
  } else if (text) {
    target.searchParams.set("text", text.slice(0, 500));
  }
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
