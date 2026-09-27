import { after, NextResponse, type NextRequest } from "next/server";
import { logServerEvent } from "@/lib/analytics/store";
import { verifyStandardWebhook } from "@/lib/security/standard-webhooks";
import { otpAllowed } from "@/lib/sms/limits";
import { hookPhone, otpMessage } from "@/lib/sms/otp";
import { sendSms } from "@/lib/sms/send";

/**
 * Supabase Auth "Send SMS" hook (Authentication → Hooks → Send SMS → HTTPS). Supabase makes
 * and checks the sign-in code; this endpoint only delivers it through the Bangladeshi SMS
 * provider. Called by Supabase, never by browsers: every request must carry a valid
 * Standard Webhooks signature made with VELTO_SMS_HOOK_SECRET.
 *
 * Limits here apply however the code was requested (the website or a direct Auth API call):
 * Bangladeshi mobiles only, 5 codes per phone per hour and 300 per hour site-wide.
 */
export const dynamic = "force-dynamic";

const MAX_BODY = 20 * 1024;

const fail = (status: number, message: string) =>
  NextResponse.json({ error: { http_code: status, message } }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: NextRequest) {
  const secret = process.env.VELTO_SMS_HOOK_SECRET?.trim();
  if (!secret) return fail(503, "SMS sign-in is not configured.");

  const body = await request.text();
  if (body.length > MAX_BODY) return fail(413, "Payload too large.");
  const signed = verifyStandardWebhook(
    secret,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    body,
  );
  if (!signed) return fail(401, "Invalid signature.");

  let payload: { user?: { phone?: unknown }; sms?: { otp?: unknown } };
  try {
    payload = JSON.parse(body);
  } catch {
    return fail(400, "Invalid payload.");
  }
  const phone = hookPhone(payload.user?.phone);
  const otp = typeof payload.sms?.otp === "string" && /^\d{4,10}$/.test(payload.sms.otp) ? payload.sms.otp : null;
  if (!phone) return fail(400, "Only Bangladeshi mobile numbers can receive a code.");
  if (!otp) return fail(400, "Invalid payload.");

  const [perPhone, global] = await Promise.all([otpAllowed("phone", phone), otpAllowed("global", "site")]);
  if (!perPhone || !global) {
    after(() => logServerEvent("otp_error", "/api/auth/sms-hook", "rate_limited"));
    return fail(429, "Too many codes requested. Please try again later.");
  }

  const sent = await sendSms(phone, otpMessage(otp));
  if (!sent.ok) {
    console.error("otp_sms_failed", sent.provider, sent.code, sent.ms);
    after(() => logServerEvent("otp_error", "/api/auth/sms-hook", sent.code));
    return fail(502, "We couldn't send the SMS. Please try again.");
  }
  return NextResponse.json({}, { headers: { "cache-control": "no-store" } });
}
