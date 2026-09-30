/**
 * "New" on Bookings & quotes: requests that came in after this person last opened the page.
 * The menu badge counts only these, so a new booking stands out even while older ones are
 * still being worked on (they stay in the list, just not in the badge). Opening the page marks
 * everything shown as seen. Kept per browser in a staff-only cookie, like notifications.
 * Runtime-neutral (unit-tested).
 */
export const REQUESTS_SEEN_COOKIE = "velto_admin_requests_seen";

/** Without a cookie yet (first visit on this browser), requests from the last day count as new. */
const FIRST_VISIT_WINDOW_MS = 24 * 3_600_000;

/** The seen time from the cookie (ms), or null when missing or malformed. */
export function readSeen(raw: string | undefined | null): number | null {
  if (!raw || !/^\d{1,15}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/** True when this request arrived after the last visit (and is still open). */
export function isUnseen(r: { created_at: string; status?: string | null }, seen: number | null, now = Date.now()): boolean {
  if (r.status === "done") return false;
  const at = Date.parse(r.created_at);
  if (!Number.isFinite(at)) return false;
  return seen === null ? now - at < FIRST_VISIT_WINDOW_MS : at > seen;
}

/** How many open requests are new since the last visit: the menu badge. */
export const unseenCount = (rows: { created_at: string; status?: string | null }[], seen: number | null, now = Date.now()) =>
  rows.filter((r) => isUnseen(r, seen, now)).length;

/**
 * The value to store after a visit: the newest request the page showed (not "now", so a request
 * that lands while the page is loading is still new), never moving backwards, never in the future.
 */
export function nextSeen(current: number | null, newestShown: number, now = Date.now()): number | null {
  if (!Number.isFinite(newestShown) || newestShown <= 0) return current;
  const next = Math.min(newestShown, now);
  return current !== null && current >= next ? current : next;
}
