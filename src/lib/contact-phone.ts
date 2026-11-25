/**
 * Velto's phone number (calls and WhatsApp, the same on both Google Business Profiles; owner-
 * confirmed 2026-11-25). Stored once as digits in Admin → Site settings (whatsappNumber); these
 * format it for people, for tel: links and for structured data. Pure.
 */

/** "8801605162788" → "+880 1605-162788", the way Bangladeshi numbers are usually written. */
export function phoneDisplay(digits: string): string {
  const m = /^880(1\d{3})(\d{6})$/.exec(digits);
  return m ? `+880 ${m[1]}-${m[2]}` : `+${digits}`;
}

/** "8801605162788" → "tel:+8801605162788". */
export const phoneHref = (digits: string) => `tel:+${digits}`;
