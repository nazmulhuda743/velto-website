/**
 * "After the request": what happened to each website booking or quote once it reached Velto,
 * from `website_request_outcomes` (docs/technical/sql/website_request_outcomes.sql).
 * Request → picked up → delivered → ordered again, overall and by source.
 *
 * Unlike the session funnel this is not consent-gated: every request is counted (its source is
 * first-party attribution stored with the request). Pure, so it is unit-tested; a rate is only
 * shown when its denominator is non-zero.
 */
import { CHANNEL_LABELS, CHANNEL_ORDER, classifyChannel, type Channel } from "../analytics/classify";

export type OutcomeRow = {
  lead_id: string;
  created_at: string;
  kind: "booking" | "quote";
  service: string | null;
  device: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
  click_id: string | null;
  landing_page: string | null;
  cancelled: boolean;
  picked: boolean;
  order_number: string | null;
  delivered: boolean;
  ordered_again: boolean;
  /** Had an order before this request; null when the customer isn't known yet. */
  returning_customer: boolean | null;
};

export const OUTCOME_STAGES = [
  { key: "requests", label: "Sent a request", hint: "Bookings and quotes received" },
  { key: "picked", label: "Picked up", hint: "Collected, or an Ops order linked" },
  { key: "delivered", label: "First order delivered", hint: "That order is Delivered in Ops" },
  { key: "again", label: "Ordered again", hint: "The same customer placed another order" },
] as const;

export type OutcomeStep = {
  key: (typeof OUTCOME_STAGES)[number]["key"];
  label: string;
  hint: string;
  count: number;
  ofTotal: number | null;
  fromPrevious: number | null;
  dropOff: number | null;
};

const rate = (n: number, d: number) => (d > 0 ? n / d : null);

/** Stages are cumulative: an order counted as delivered was also picked up. */
const reachedOf = (r: OutcomeRow) => (r.ordered_again && r.delivered ? 3 : r.delivered ? 2 : r.picked ? 1 : 0);

export function outcomeFunnel(rows: OutcomeRow[]) {
  const reached = OUTCOME_STAGES.map(() => 0);
  for (const r of rows) for (let i = 0; i <= reachedOf(r); i++) reached[i] += 1;
  const steps: OutcomeStep[] = OUTCOME_STAGES.map((stage, i) => {
    const fromPrevious = i === 0 ? rate(reached[0], reached[0]) : rate(reached[i], reached[i - 1]);
    return {
      ...stage,
      count: reached[i],
      ofTotal: rate(reached[i], reached[0]),
      fromPrevious,
      dropOff: i === 0 || fromPrevious === null ? null : 1 - fromPrevious,
    };
  });
  const cancelled = rows.filter((r) => r.cancelled).length;
  const known = rows.filter((r) => r.returning_customer !== null);
  const returning = known.filter((r) => r.returning_customer).length;
  const open = rows.filter((r) => !r.cancelled && !r.picked).length;
  return { steps, cancelled, open, returning, newCustomers: known.length - returning };
}

export type OutcomeSourceRow = {
  key: Channel;
  label: string;
  requests: number;
  picked: number;
  delivered: number;
  again: number;
  cancelled: number;
  pickupRate: number | null;
  repeatRate: number | null;
};

export function outcomesByChannel(rows: OutcomeRow[]): OutcomeSourceRow[] {
  const groups = new Map<Channel, OutcomeRow[]>();
  for (const r of rows) {
    const c = classifyChannel(r);
    groups.set(c, [...(groups.get(c) ?? []), r]);
  }
  return CHANNEL_ORDER.filter((c) => groups.has(c)).map((c) => {
    const g = groups.get(c)!;
    const picked = g.filter((r) => reachedOf(r) >= 1).length;
    const delivered = g.filter((r) => reachedOf(r) >= 2).length;
    const again = g.filter((r) => reachedOf(r) >= 3).length;
    return {
      key: c,
      label: CHANNEL_LABELS[c],
      requests: g.length,
      picked,
      delivered,
      again,
      cancelled: g.filter((r) => r.cancelled).length,
      pickupRate: rate(picked, g.length),
      repeatRate: rate(again, delivered),
    };
  });
}
