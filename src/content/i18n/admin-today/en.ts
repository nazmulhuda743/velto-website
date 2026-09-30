/**
 * English text for the admin "Today" scheduling page (phone-first, used by the office and
 * dispatch staff). The Bangla file (bn.ts) has the same keys; the page picks the language
 * with todayText() in index.ts. Values that take data are small functions so each language
 * controls its own word order and digits.
 *
 * Shown as they come from Velto Ops: customer names, order numbers (VEL-01952), rider names.
 */
export const todayEn = {
  title: "Today",
  tabs: { call: "Call", assign: "Assign", deliver: "Deliver", route: "Route" },
  /** Time windows, keyed by the dispatch slot id. */
  windows: { morning: "Morning 9–12", afternoon: "Afternoon 12–4", evening: "Evening 4–8" },
  nextUp: "Next up",
  then: "Then",
  lateNote: (n: number) => `${n} ${n === 1 ? "customer" : "customers"} waiting over 30 min`,
  confirmFor: (window: string) => `Confirmed for ${window}`,
  call: "Call",
  whatsapp: "WhatsApp",
  noAnswer: "No answer",
  waitingMin: (m: number) => `${m} min`,
  chooseRider: "Choose rider",
  planDelivery: "Plan delivery",
  readySince: (t: string) => `Ready since ${t}`,
  assignTo: (name: string) => `Assign ${name}`,
  assignHint: "Riders see it in Velto Ops → Assigned to me.",
  sector: (area: number | string) => `Sector ${area}`,
  mostFree: "Most free",
  full: "Full",
  offToday: "Off today",
  free: "Free",
  stopsOf: (a: number, b: number) => `${a}/${b} stops`,
  pickup: "Pickup",
  delivery: "Delivery",
  routeHint: "Tap a rider to see their stops.",
  allDone: "All done here",
  allDoneSub: "Nothing left in this list.",
  opsDown: (t: string) => `Can't reach Velto Ops right now. Showing the list from ${t}.`,
  retry: "Retry",
  firstOrder: "First website order · 10% off",
  callback: "Call-back",
  weekly: "Weekly",
  changedTime: "Changed time",
  pickedUp: "Picked up",
  delivered: "Delivered",
  markedPicked: "Marked as picked up",
  markedDelivered: "Marked as delivered",
  cancelBooking: "Cancel booking",
  whichOrder: "Which order?",
  help: "Work top to bottom: call new customers, give each job a rider, plan deliveries for Ready orders. Riders see their jobs in Velto Ops.",
};

export type TodayText = typeof todayEn;
