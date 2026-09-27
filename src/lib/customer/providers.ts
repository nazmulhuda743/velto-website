import "server-only";

import { customerAuthConfig } from "./config";

/**
 * Which extra sign-in methods can work, from Supabase Auth's public /auth/v1/settings:
 * "Continue with Google" and "sign in with your mobile number" only render when that provider
 * is switched on in the Supabase dashboard, so turning one on or off needs no deploy and a
 * visitor never lands on a "provider is not enabled" error. Cached for five minutes.
 */
export async function authProviders(): Promise<{ google: boolean; phone: boolean }> {
  const config = customerAuthConfig();
  if (!config) return { google: false, phone: false };
  try {
    const res = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { google: false, phone: false };
    const settings = (await res.json()) as { external?: { google?: boolean; phone?: boolean } };
    return { google: settings.external?.google === true, phone: settings.external?.phone === true };
  } catch {
    return { google: false, phone: false };
  }
}
