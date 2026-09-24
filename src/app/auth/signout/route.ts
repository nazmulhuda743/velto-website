import { NextResponse, type NextRequest } from "next/server";
import { createPortalServerClient } from "@/lib/supabase/portal-server";

export async function POST(request: NextRequest) {
  const supabase = await createPortalServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?state=signed-out", request.url), 303);
}
