import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { customerAuthConfig } from "./config";

/** Auth cookies are only ever read on the server, so they can be httpOnly. */
export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Supabase client bound to the visitor's session cookies (Server Components, Server
 * Actions, Route Handlers). Uses the publishable key: every query runs as the signed-in
 * customer, so the database decides what they can see.
 */
export async function customerSupabase() {
  const config = customerAuthConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
        } catch {
          // Server Components can't write cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
