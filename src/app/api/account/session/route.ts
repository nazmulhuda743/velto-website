import { NextResponse } from "next/server";
import { hasPortalSession } from "@/lib/supabase/portal-server";

export async function GET() {
  return NextResponse.json(
    { authenticated: await hasPortalSession() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
