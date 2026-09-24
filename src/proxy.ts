import type { NextRequest } from "next/server";
import { refreshPortalSession } from "@/lib/supabase/portal-proxy";

export async function proxy(request: NextRequest) {
  return refreshPortalSession(request);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
    "/api/account/:path*",
    "/book",
  ],
};
