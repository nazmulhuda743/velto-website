/**
 * The six notification switches (Profile → Notifications). Everything operational is on by
 * default; offers stay off unless the customer opts in. Shared by the pages (server) and the
 * card (browser), so no server-only imports here.
 */
export type PushPrefs = {
  orderUpdates: boolean;
  pickupUpdates: boolean;
  careUpdates: boolean;
  paymentUpdates: boolean;
  reminders: boolean;
  offers: boolean;
};

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  orderUpdates: true,
  pickupUpdates: true,
  careUpdates: true,
  paymentUpdates: true,
  reminders: true,
  offers: false,
};

/** website_push_status → the switches; any key missing (database not yet updated) gets its default. */
export function pushPrefsFromStatus(status: Partial<Record<keyof PushPrefs, unknown>> | null | undefined): PushPrefs | undefined {
  if (!status) return undefined;
  const pick = (k: keyof PushPrefs) => (typeof status[k] === "boolean" ? (status[k] as boolean) : DEFAULT_PUSH_PREFS[k]);
  return {
    orderUpdates: pick("orderUpdates"),
    pickupUpdates: pick("pickupUpdates"),
    careUpdates: pick("careUpdates"),
    paymentUpdates: pick("paymentUpdates"),
    reminders: pick("reminders"),
    offers: pick("offers"),
  };
}
