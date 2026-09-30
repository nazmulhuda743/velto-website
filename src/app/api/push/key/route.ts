import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push/server";
import { isSupabaseConfigured } from "@/lib/supabase-server";

/** The public half of Velto's notification key, for the browser's "Allow" step. */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503, headers });
  try {
    return NextResponse.json({ ok: true, publicKey: await vapidPublicKey() }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
