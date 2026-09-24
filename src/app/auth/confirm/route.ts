import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safePortalNext } from "@/lib/supabase/portal-config";
import { createPortalServerClient } from "@/lib/supabase/portal-server";

const TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "magiclink", "invite", "email_change"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safePortalNext(request.nextUrl.searchParams.get("next"));
  const clean = request.nextUrl.clone();
  clean.search = "";
  const supabase = await createPortalServerClient();
  if (tokenHash && rawType && TYPES.has(rawType) && supabase) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType });
    if (!error) {
      clean.pathname = rawType === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(clean);
    }
  }
  clean.pathname = rawType === "recovery" ? "/reset-password" : "/login";
  clean.searchParams.set(rawType === "recovery" ? "invalid" : "error", "1");
  return NextResponse.redirect(clean);
}
