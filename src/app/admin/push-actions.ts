"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { isAdminPreview } from "@/lib/admin/preview";
import { requireSection } from "@/lib/admin/session";
import { normaliseBdPhone } from "@/lib/customer/validation";
import { staffTestMessage } from "@/lib/push/messages";
import { sendAndReport, type PushTarget } from "@/lib/push/server";
import { supabaseRpc } from "@/lib/supabase-server";

const back = (params: Record<string, string>): never => redirect(`/admin/accounts?${new URLSearchParams(params)}#notifications`);

/** Staff send one test notification to a customer's phone(s) and see what the push service said. */
export async function sendTestPushAction(form: FormData) {
  const admin = await requireSection("accounts");
  const phone = normaliseBdPhone(String(form.get("phone") ?? "").slice(0, 20));
  if (!phone) return back({ push: "invalid" });
  if (isAdminPreview()) back({ push: "sent", n: "1", phone });

  let targets: PushTarget[] = [];
  try {
    targets = await supabaseRpc<PushTarget[]>("website_push_targets_for_phone", { p_phone: phone });
  } catch {
    back({ push: "unavailable", phone });
  }
  if (!targets.length) back({ push: "none", phone });

  const results = await Promise.all(targets.map((t) => sendAndReport(t, staffTestMessage(t.lang === "en" ? "en" : "bn"))));
  const delivered = results.filter((r) => r.ok).length;
  await logActivity(admin, {
    section: "accounts",
    action: "push_test",
    // The activity log never holds customer phone numbers: the last three digits are enough.
    target: `…${phone.slice(-3)}`,
    summary: `Sent a test notification to a phone ending ${phone.slice(-3)}: ${delivered} of ${results.length} accepted by the push service`,
  });
  if (delivered) back({ push: "sent", n: String(delivered), phone });
  back({ push: "failed", status: results.map((r) => r.status || "network").join(","), phone });
}
