/**
 * "Open to booked" for the app report: when the app was last opened (or brought back to the
 * screen) in this tab, and how long a booking took from then, as a coarse bucket. Browser only;
 * sessionStorage, so nothing outlives the tab and nothing identifies the customer.
 */
const OPENED_AT = "velto_app_opened_at";

export function markAppOpen(now = Date.now()) {
  try {
    sessionStorage.setItem(OPENED_AT, String(now));
  } catch {
    /* storage unavailable: measurement is best-effort */
  }
}

/** Seconds from open to now, bucketed: "0-30", "30-60", "60-120", "120-plus" (undefined when unknown). */
export function openToNowBucket(now = Date.now()): string | undefined {
  let at = NaN;
  try {
    at = Number(sessionStorage.getItem(OPENED_AT));
  } catch {
    return undefined;
  }
  if (!Number.isFinite(at) || at <= 0 || now < at) return undefined;
  return secondsBucket((now - at) / 1000);
}

export function secondsBucket(seconds: number): string {
  if (seconds < 30) return "0-30";
  if (seconds < 60) return "30-60";
  if (seconds < 120) return "60-120";
  return "120-plus";
}
