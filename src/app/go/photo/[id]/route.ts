import { NextResponse } from "next/server";
import { signedBookingPhotoUrl } from "@/lib/booking-photos-store";

/**
 * Opens a booking photo from the Ops task: redirects to a signed Storage URL that expires in
 * ten minutes, so the link in the task keeps working while the file itself stays private.
 * The id is 128 random bits; /go/ is excluded from search engines (robots.txt).
 */
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = await signedBookingPhotoUrl((await params).id).catch(() => null);
  if (!url) return new NextResponse("Photo not found.", { status: 404, headers: HEADERS });
  return NextResponse.redirect(url, { status: 302, headers: HEADERS });
}
