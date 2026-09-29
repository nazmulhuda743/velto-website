/**
 * When Velto calls customers back. A request made at night (9 PM to 9 AM, Dhaka) is called the
 * next morning from 9 AM, so the customer is told "in the morning" instead of "soon", and the
 * managers' alert says so too. 9 AM is when the first outlet opens and the first pickup window
 * starts; 9 PM is when the earlier outlet closes. Runtime-neutral (browser and server).
 */
export const CALL_HOURS = { from: 9, until: 21 } as const;

/** The hour (0–23) in Dhaka (UTC+6, no daylight saving) at a moment. */
export const dhakaHour = (now: number | Date = Date.now()) => new Date((typeof now === "number" ? now : now.getTime()) + 6 * 3_600_000).getUTCHours();

/** True outside call hours: before 9 AM or from 9 PM, Dhaka time. */
export const isNightDhaka = (now: number | Date = Date.now()) => {
  const h = dhakaHour(now);
  return h < CALL_HOURS.from || h >= CALL_HOURS.until;
};

/** What the managers' alert asks for: a call now, or a call in the morning. */
export const callAsk = (now: number | Date = Date.now()) => (isNightDhaka(now) ? "Night request: call in the morning (from 9 AM)." : "Call within 30 min.");
