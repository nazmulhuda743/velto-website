/**
 * Who may book on the website (owner decision, 2026-10-03): only a signed-in customer with a
 * verified mobile. The booking then carries that verified number, whatever was typed, so the
 * Ops record and the customer's account (which finds its pickups by phone) always agree.
 * Pure: takes the shape of CustomerSession, no server imports (tested in tests/booking-caller.test.cjs).
 */

export type BookingCallerSession = {
  kind: string;
  account?: { state: string; phone?: string | null; phoneVerified?: boolean | null };
};

export type BookingCaller = { ok: true; phone: string } | { ok: false; code: "sign_in_required" };

export function bookingCaller(session: BookingCallerSession): BookingCaller {
  if (session.kind !== "customer" || !session.account) return { ok: false, code: "sign_in_required" };
  const { state, phone } = session.account;
  // "ready" means name + verified phone + accepted terms; an unfinished (Google) account only
  // counts once its phone has been proven.
  const usable = typeof phone === "string" && /^01\d{9}$/.test(phone) && (state === "ready" || session.account.phoneVerified === true);
  return usable ? { ok: true, phone } : { ok: false, code: "sign_in_required" };
}
