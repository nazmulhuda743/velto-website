import { NextResponse, type NextRequest } from "next/server";
import { safePortalNext } from "@/lib/supabase/portal-config";
import { createPortalServerClient } from "@/lib/supabase/portal-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safePortalNext(request.nextUrl.searchParams.get("next"));
  const clean = request.nextUrl.clone();
  clean.search = "";
  const supabase = await createPortalServerClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      clean.pathname = next;
      return NextResponse.redirect(clean);
    }
  }
  clean.pathname = next === "/reset-password" ? "/reset-password" : "/login";
  clean.searchParams.set(next === "/reset-password" ? "invalid" : "error", "1");
  return NextResponse.redirect(clean);
}
