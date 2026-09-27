import "server-only";

import { createHash } from "node:crypto";
import { isSupabaseConfigured, supabaseRpc } from "@/lib/supabase-server";

/**
 * Durable limits on sign-in codes (docs/technical/sql/website_otp.sql). Keys are hashed, so
 * no phone number or IP address is stored. Limits per hour: 5 codes per phone, 10 per IP,
 * 300 for the whole site (a ceiling on the SMS bill if something goes wrong), and 10 code
 * checks per phone.
 * Fails closed: if the limiter can't answer, no SMS is sent.
 */
export type OtpBucket = "phone" | "ip" | "global" | "verify";

export async function otpAllowed(bucket: OtpBucket, value: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const key = createHash("sha256").update(`otp:${bucket}:${value}`).digest("hex");
  try {
    const r = await supabaseRpc<{ ok?: unknown; allowed?: unknown }>("website_otp_rate_limit", { p_bucket: bucket, p_rate_key: key });
    return r.ok === true && r.allowed === true;
  } catch (error) {
    console.error("otp_rate_limit_failed", error instanceof Error ? error.message : "unknown");
    return false;
  }
}
