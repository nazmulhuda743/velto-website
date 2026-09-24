import { NextResponse, type NextRequest } from "next/server";
import { getPricingSource, isPricingConfigured as isLiveConfigured } from "@/lib/integrations/pricing/server";
import type { PublicPriceItem } from "@/lib/integrations/pricing/types";
import { logServerEvent } from "@/lib/observability/log";
import { searchPriceItems } from "@/lib/pricing";

const QUERY_ALIASES: Record<string, string> = {
  saree: "sari",
  sharee: "sari",
  shari: "sari",
  comforter: "blanket",
  comforters: "blanket",
  tshirt: "t-shirt",
  tshirts: "t-shirt",
  punjabi: "panjabi",
  punjabee: "panjabi",
  lehenga: "lahanga",
  lehanga: "lahanga",
  bedsheet: "bed sheet",
  bedsheets: "bed sheet",
};

function normalizeQuery(raw: string): string {
  const cleaned = raw
    .replace(/[,()."'`:;*%\\]/g, " ")
    .replace(/\bt[\s-]shirt\b/gi, "tshirt")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned
    .split(" ")
    .map((word) => QUERY_ALIASES[word.toLowerCase()] ?? word)
    .join(" ");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";

  if (process.env.NODE_ENV !== "production") {
    const mock = request.nextUrl.searchParams.get("mock");
    if (mock === "error") return NextResponse.json({ error: "unavailable" }, { status: 503 });
    if (mock === "slow") await new Promise((r) => setTimeout(r, 30_000));
  }

  const liveConfigured = isLiveConfigured();
  if (process.env.VERCEL_ENV === "production" && !liveConfigured) {
    logServerEvent("pricing_configuration_failure", "error", { route: "/api/prices", code: "missing_live_config" });
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const query = normalizeQuery(q.slice(0, 64));
    let items: PublicPriceItem[];
    let source: "live" | "mock";
    if (query.trim().length < 2) {
      items = [];
      source = liveConfigured ? "live" : "mock";
    } else if (liveConfigured) {
      items = await getPricingSource().search({ query, limit: 5 });
      source = "live";
    } else {
      items = await searchPriceItems(query);
      source = "mock";
    }
    return NextResponse.json({ items, source }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    logServerEvent("pricing_upstream_failure", "error", { route: "/api/prices", code: "upstream_failed" });
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
