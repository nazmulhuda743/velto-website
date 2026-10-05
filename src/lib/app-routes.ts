/**
 * Where the customer screens link to, by surface: the website's account (`/account`, `/book`, …) or
 * the installed app's own pages (`/app/home`, `/app/book`, …). Screens are shared (the account views
 * render on both); each takes `base` and asks here for its links, so the app never links out of
 * `/app/` and the website never links into it. Pure (tested in tests/app-routes.test.cjs).
 */

export type AppBase = "/account" | "/app";

export type CustomerRoutes = {
  home: string;
  /** Book a pickup, with optional query (source, service, repeat, …). */
  book: (query?: string | URLSearchParams | Record<string, string>) => string;
  orders: string;
  order: (orderNumber: string, hash?: string) => string;
  profile: string;
  rewards: string;
  prices: string;
};

const withQuery = (path: string, query?: string | URLSearchParams | Record<string, string>) => {
  if (!query) return path;
  const q = typeof query === "string" ? query.replace(/^\?/, "") : new URLSearchParams(query).toString();
  return q ? `${path}?${q}` : path;
};

export function customerRoutes(base: AppBase = "/account"): CustomerRoutes {
  const app = base === "/app";
  const orders = app ? "/app/orders" : "/account/orders";
  return {
    home: app ? "/app/home" : "/account",
    book: (query) => withQuery(app ? "/app/book" : "/book", query),
    orders,
    order: (n, hash) => `${orders}/${encodeURIComponent(n)}${hash ? `#${hash.replace(/^#/, "")}` : ""}`,
    profile: app ? "/app/profile" : "/account/profile",
    rewards: app ? "/app/rewards" : "/account/rewards",
    prices: app ? "/app/prices" : "/pricing",
  };
}

/** A base from an untrusted form field (server actions): anything else is the website. */
export const parseBase = (v: unknown): AppBase => (v === "/app" ? "/app" : "/account");

/** Request header the proxy sets with the visible path, so the app can send a signed-out customer back to it. */
export const PATH_HEADER = "x-velto-path";
