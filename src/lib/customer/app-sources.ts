/**
 * Where an app booking started. The value goes into the booking's `source` (kept on the Ops task
 * and `website_leads.source`, whatever the consent choice) and into the `placement` of the
 * booking events, so the app report can tell a one-tap rebook from a booking made on the Book tab.
 * Underscores only.
 */
export const APP_SOURCE = {
  /** Home's "Same as last time" / "Welcome back" card, booked in one tap. */
  homeCard: "app_home_card",
  /** "Change" on that card: opens Book with the last order. */
  homeChange: "app_home_change",
  /** "Book something else" on the welcome-back card. */
  homeOther: "app_home_other",
  /** The first-pickup card on Home. */
  homeFirst: "app_home_first",
  /** The Book tab in the tab bar. */
  bookTab: "app_book_tab",
  /** "Book this again" on a delivered order. */
  bookAgain: "app_book_again",
  /** The empty Orders screen. */
  orders: "app_orders",
  /** "Book a pickup" under the prices sheet or page. */
  prices: "app_prices",
} as const;

export type AppSource = (typeof APP_SOURCE)[keyof typeof APP_SOURCE];

const KNOWN = new Set<string>(Object.values(APP_SOURCE));

/** The booking's source from the Book screen's `?source=`; anything else counts as the Book screen itself. */
export const appBookSource = (value: string | undefined): string => (value && KNOWN.has(value) ? value : "app_book");
