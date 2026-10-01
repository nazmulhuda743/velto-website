import "server-only";

import { after, NextResponse } from "next/server";
import { logServerEvent } from "@/lib/analytics/store";
import { bookingEstimateText } from "@/lib/booking-estimate";
import { cleanBookingItems } from "@/lib/booking-items";
import { couponNote, usableCoupon } from "@/lib/customer/goal";
import { offerNoteFor, type FirstOrder } from "@/lib/first-order-offer";
import { firstWebsiteBooking } from "@/lib/first-order-lookup";
import { getCustomerSession, getGoal } from "@/lib/customer/portal";
import { getSiteContent } from "@/lib/site-content";
import { getCapacityConfig, zoneForArea } from "@/lib/capacity";
import {
  IntegrationError,
  integrationLogContext,
  toSafeIntegrationError,
  type SafeErrorCode,
} from "@/lib/integrations/errors";
import { getOpsGateway } from "@/lib/integrations/ops/server";
import {
  validateBookingSubmission,
  validateSubmissionContext,
  type ValidationIssue,
} from "@/lib/integrations/ops/validation";
import { notifyNewRequest } from "@/lib/admin/dispatch";
import { newRequestPush } from "@/lib/admin/request-flow";
import { SITE_URL } from "@/lib/site-url";

/**
 * Website-owned booking (spec §8), used by /api/bookings and /api/rhythm/book. Wire format:
 *   POST { data: BookingSubmission-shaped fields + attribution, idempotencyKey }
 *   → 200 { ok: true, reference, requestId }
 *   → 400 invalid_request (+ field issues), 501 while no Ops gateway is
 *     configured, 409/502/504 mapped from gateway errors. Customer responses
 *     never carry upstream messages (Codex error contract).
 */
const fail = (
  code: SafeErrorCode,
  requestId: string,
  retryable: boolean,
  status: number,
  issues?: ValidationIssue[],
) =>
  NextResponse.json(
    { ok: false as const, error: { code, requestId, retryable }, ...(issues ? { issues } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );

/** The signed-in customer's monthly-goal coupon for today, worded for Ops; null for everyone else. */
async function couponForCaller(): Promise<string | null> {
  const session = await getCustomerSession();
  if (session.kind !== "customer" || session.account.state !== "ready" || session.account.link.status !== "linked") return null;
  const { loyalty } = await getSiteContent();
  const goal = loyalty.goal.enabled ? await getGoal(loyalty.goal.doubleFirst).catch(() => null) : null;
  const c = goal ? usableCoupon(goal.coupons, goal.today) : null;
  return c ? couponNote(c) : null;
}

/**
 * The offer line for the Ops notes (lib/first-order-offer.ts): 10% off the number's first website
 * booking, signed in or not, with the customer's goal coupon when they hold one (staff apply
 * whichever saves more).
 */
async function offerForBooking(phone: unknown): Promise<string | undefined> {
  const [first, coupon] = await Promise.all([
    typeof phone === "string" ? firstWebsiteBooking(phone) : Promise.resolve<FirstOrder>("unknown"),
    couponForCaller().catch(() => null),
  ]);
  return offerNoteFor(first, coupon);
}

/**
 * The booking itself, shared by /api/bookings and the one-tap reminder link (/api/rhythm/book):
 * `input` is the parsed request body ({ data, idempotencyKey }).
 */
export async function handleBooking(input: Record<string, unknown>, requestId: string): Promise<NextResponse> {
  // The estimate comes from the Ops price list on the server, never from the browser.
  const data = input.data && typeof input.data === "object" ? (input.data as Record<string, unknown>) : {};
  const items = cleanBookingItems(data.items);
  const estimate = items?.length ? await bookingEstimateText(items).catch(() => undefined) : undefined;
  // 10% off the number's first website booking, with a monthly-goal coupon when one is held.
  const offerNote = await offerForBooking(data.phone).catch(() => undefined);
  const parsed = validateBookingSubmission(input.data, { estimate, siteUrl: SITE_URL, coupon: offerNote });
  const context = validateSubmissionContext({ idempotencyKey: input.idempotencyKey, requestId });
  if (!parsed.ok || !context.ok) {
    const issues = [...(parsed.ok ? [] : parsed.issues), ...(context.ok ? [] : context.issues)];
    return fail("invalid_request", requestId, false, 400, issues);
  }

  const gateway = getOpsGateway();
  if (!gateway) return fail("booking_unavailable", requestId, true, 501);

  // Capacity on: a pickup in a zoned sector must book a window (a stale page can't skip it).
  // Off: any window sent is only a preference, and Velto confirms by phone as before.
  const capacity = await getCapacityConfig();
  if (!capacity.enabled) delete parsed.value.slot;
  else if (!parsed.value.slot && (await zoneForArea(parsed.value.area))) {
    return fail("invalid_request", requestId, false, 400, [{ field: "slot", code: "required" }]);
  }

  try {
    const result = await gateway.createBooking(parsed.value, context.value);
    // Tell the managers now, after the response is sent (best effort).
    after(() => notifyNewRequest(newRequestPush("booking", { name: parsed.value.name, area: parsed.value.area, when: parsed.value.preferredPickup, service: parsed.value.service }, SITE_URL)));
    return NextResponse.json(
      { ok: true as const, reference: result.reference, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("booking_failed", integrationLogContext(error, "booking", requestId));
    const safe = toSafeIntegrationError(error, requestId, "booking_unavailable");
    if (!(error instanceof IntegrationError && error.code === "duplicate_submission")) {
      after(() => logServerEvent("booking_error", "/api/bookings", safe.error.code));
    }
    const status =
      error instanceof IntegrationError && (error.code === "duplicate_submission" || error.code === "slot_unavailable")
        ? 409
        : error instanceof IntegrationError && error.code === "request_timeout"
          ? 504
          : 502;
    return NextResponse.json(safe, { status, headers: { "Cache-Control": "no-store" } });
  }
}
