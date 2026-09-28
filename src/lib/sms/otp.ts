import { normaliseBdPhone } from "../customer/validation";

/**
 * Pure helpers for SMS sign-in codes. No server imports, so they compile inside the
 * foundation test build.
 */

/** How long a code stays valid. Must match Supabase Auth → Providers → Phone → OTP expiry. */
export const OTP_TTL_MINUTES = 5;
export const OTP_LENGTH = 6;

/** 01XXXXXXXXX → the E.164 form Supabase Auth stores ("+8801XXXXXXXXX"). */
export const bdPhoneToE164 = (local: string) => `+88${local}`;

/**
 * The Bangladeshi mobile a hook payload is for, as 01XXXXXXXXX, or null. Anything that isn't
 * a Bangladeshi mobile is refused before an SMS is paid for.
 */
export function hookPhone(raw: unknown): string | null {
  return typeof raw === "string" && raw.length <= 20 ? normaliseBdPhone(raw) : null;
}

export const validOtp = (raw: string) => {
  const code = raw.replace(/\s+/g, "");
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code) ? code : null;
};

/**
 * English on purpose: plain GSM-7 text fits one SMS (Bangla switches to Unicode and costs two
 * or three). Bangladeshi SMS gateways require OTP messages to start with the brand in brackets:
 * the GreenWeb token's "OTP SMS Header" is set to "(Velto)" and the gateway adds it on top, so
 * the text here doesn't repeat it (and Banglish is refused). The last line is the WebOTP /
 * Android format, so phones can offer the code for autofill on www.velto.com.bd only.
 */
export function otpMessage(code: string, host = "www.velto.com.bd") {
  return `Your sign-in code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Never share it; Velto staff will never ask for it.\n\n@${host} #${code}`;
}

/** Text for "Show my past orders" (email and Google accounts proving their phone). */
export function linkCodeMessage(code: string) {
  return `Your code to show your Velto orders is ${code}. It expires in 10 minutes. Never share it; Velto staff will never ask for it.`;
}
