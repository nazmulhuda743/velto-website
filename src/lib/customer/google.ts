import "server-only";

import { customerAuthConfig } from "./config";

/**
 * Whether "Continue with Google" can work: Supabase Auth reports its enabled providers at
 * /auth/v1/settings. The button only renders when Google is switched on there, so turning the
 * provider on or off in the Supabase dashboard is enough (no deploy), and a visitor never
 * lands on Supabase's "provider is not enabled" error page. Cached for five minutes.
 */
export async function googleSignInEnabled(): Promise<boolean> {
  const config = customerAuthConfig();
  if (!config) return false;
  try {
    const res = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
