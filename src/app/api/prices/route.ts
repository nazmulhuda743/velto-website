import { NextResponse, type NextRequest } from "next/server";
import { getPricingSource, isPricingConfigured as isLiveConfigured } from "@/lib/integrations/pricing/server";
import type { PublicPriceItem } from "@/lib/integrations/pricing/types";
import { searchPriceItems } from "@/lib/pricing";

/**
 * Public-safe pricing endpoint (spec §6). When the server pricing integration
 * is configured (VELTO_SUPABASE_URL + VELTO_SUPABASE_SECRET_KEY), results come
 * from the Codex Supabase adapter and `source` is "live"; otherwise the
 * clearly-marked mock source answers so the site keeps working until the
 * approved pricing view and credentials exist. The UI shows placeholder
 * wording only for "mock" data.
 */
/**
 * Word-level aliases so common local spellings still match the official
 * item names in the approved pricing view (e.g. "saree" → "Sari (Cotton)").
 * The list mirrors the price list's own vocabulary — it never invents items.
 */
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

/**
 * Strip characters that would break the upstream PostgREST `ilike` filter,
 * collapse whitespace, and apply the alias map word by word.
 */
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
    const query = normalizeQuery(q.slice(0, 64));
    let items: PublicPriceItem[];
    let source: "live" | "mock";
    if (query.trim().length < 2) {
      items = [];
      source = isLiveConfigured() ? "live" : "mock";
    } else if (isLiveConfigured()) {
      items = await getPricingSource().search({ query, limit: 5 });
      source = "live";
    } else {
      items = await searchPriceItems(query);
      source = "mock";
    }
    return NextResponse.json({ items, source }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never expose raw API/database errors to the browser.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
