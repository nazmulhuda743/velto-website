import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { portalSupabaseConfig } from "./portal-config";

export async function createPortalServerClient() {
  const config = portalSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values: { name: string; value: string; options: CookieOptions }[]) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export async function getPortalIdentity() {
  const supabase = await createPortalServerClient();
  if (!supabase) return null;
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const subject = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (claimsError || !subject) return null;

  // Fresh user lookup catches revoked/deleted/disabled users before customer data is queried.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.id !== subject) return null;
  return { supabase, user: userData.user, claims: claimsData.claims };
}

export async function hasPortalSession() {
  const supabase = await createPortalServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string";
}

export async function requirePortalIdentity(next = "/account") {
  const identity = await getPortalIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(next)}&reason=session`);
  return identity;
}
