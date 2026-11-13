import { NextResponse } from "next/server";
import { b999OpenDays } from "@/lib/campaigns/b999-server";
import { isSupabaseConfigured } from "@/lib/supabase-server";

/** Pickup days for the B999 package that still have space (the form refreshes after "day full"). */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!isSupabaseConfigured()) return NextResponse.json({ days: [] }, { headers });
  try {
    return NextResponse.json({ days: await b999OpenDays() }, { headers });
  } catch {
    return NextResponse.json({ days: [], error: "unavailable" }, { status: 503, headers });
  }
}
