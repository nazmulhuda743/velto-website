import { NextResponse } from "next/server";
import { logServerEvent } from "@/lib/observability/log";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const safeVersion = () => process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "unknown";

function response(status: "ok" | "degraded", dependency: "ok" | "unavailable", httpStatus: number) {
  return NextResponse.json(
    {
      status,
      dependencies: { database: dependency, pricing: dependency },
      timestamp: new Date().toISOString(),
      version: safeVersion(),
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } },
  );
}

/** Read-only launch health probe. It never writes to Supabase or exposes config. */
export async function GET() {
  if (!isSupabaseConfigured()) return response("degraded", "unavailable", 503);

  const view = process.env.VELTO_PRICING_VIEW?.trim() || "website_pricing_public";
  if (!/^[a-z][a-z0-9_]{0,62}$/i.test(view)) {
    logServerEvent("health_dependency_failure", "error", { dependency: "pricing", code: "invalid_view_config" });
    return response("degraded", "unavailable", 503);
  }

  try {
    const upstream = await supabaseFetch(`/rest/v1/${view}?select=item_slug&limit=1`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      logServerEvent("health_dependency_failure", "error", { dependency: "pricing", status: upstream.status });
      return response("degraded", "unavailable", 503);
    }
    return response("ok", "ok", 200);
  } catch {
    logServerEvent("health_dependency_failure", "error", { dependency: "pricing", code: "request_failed" });
    return response("degraded", "unavailable", 503);
  }
}
