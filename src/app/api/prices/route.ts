import { NextResponse, type NextRequest } from "next/server";
import { searchPriceItems } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";

  // Development-only hooks to preview the loading and error states (spec §29).
  if (process.env.NODE_ENV !== "production") {
    const mock = request.nextUrl.searchParams.get("mock");
    if (mock === "error") {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    if (mock === "slow") {
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }

  try {
    const items = await searchPriceItems(q.slice(0, 64));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never expose raw API/database errors to the browser.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
