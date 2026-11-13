/**
 * Facts shared by the Terms, Privacy and Cookies pages.
 *
 * Only confirmed facts live here. Anything the owner still has to confirm is
 * `null` and is simply not rendered until it is filled in, so no placeholder
 * text reaches customers. Open items: docs/legal/LEGAL-REVIEW.md.
 */
export const LEGAL = {
  /** Trading name used on the website. */
  tradingName: "Velto Premium Laundry",
  /** TODO_VERIFY: registered legal entity (e.g. "… Limited" or proprietorship name). */
  legalEntity: null as string | null,
  /** TODO_VERIFY: trade licence number, if Velto wants it shown. */
  tradeLicence: null as string | null,
  /** TODO_VERIFY: a monitored email for privacy and legal requests. */
  email: null as string | null,
  /** Owner-confirmed WhatsApp number (also set in the admin dashboard). */
  whatsappDisplay: "+880 1605-162788",
  /** Date shown as "Last updated" on Terms and Cookies (and Privacy unless it has its own). */
  updated: "1 October 2026",
  /** Privacy's own "Last updated": booking photos and invoice condition photos added. */
  privacyUpdated: "13 November 2026",
};
