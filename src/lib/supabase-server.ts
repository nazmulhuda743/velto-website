import "server-only";

import { normalizeProjectUrl } from "./integrations/pricing/supabase-rest";

const TIMEOUT_MS = 6_000;

export const isSupabaseConfigured = () =>
  Boolean(process.env.VELTO_SUPABASE_URL && process.env.VELTO_SUPABASE_SECRET_KEY);

export function supabaseOrigin() {
  const url = process.env.VELTO_SUPABASE_URL;
  if (!url) throw new Error("VELTO_SUPABASE_URL is not configured");
  return normalizeProjectUrl(url);
}

/**
 * Server-only request to the Velto Supabase project with the service key.
 * Never import from client code; never return raw upstream errors to users.
 */
export async function supabaseFetch(path: string, init: RequestInit = {}) {
  const key = process.env.VELTO_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("VELTO_SUPABASE_SECRET_KEY is not configured");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(new URL(path, supabaseOrigin()), {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Calls a service-role-only database function and returns its JSON result. */
export async function supabaseRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await supabaseFetch(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${fn} failed with HTTP ${res.status}`);
  return (await res.json()) as T;
}
