"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { isAdminPreview } from "@/lib/admin/preview";
import { requireSection } from "@/lib/admin/session";
import { normaliseBdPhone } from "@/lib/customer/validation";
import { PUSH_DESIGNS, renderPush, type PushStateId } from "@/lib/push/catalog";
import { sampleContext } from "@/lib/push/samples";
import { sendAndReport, type PushTarget } from "@/lib/push/server";
import { supabaseRpc } from "@/lib/supabase-server";

const PATH = "/admin/accounts/notifications";
const back = (params: Record<string, string>): never => redirect(`${PATH}?${new URLSearchParams(params)}`);

/** Send one design, with sample details, to a phone that has notifications on (owner review). */
export async function sendDesignAction(form: FormData) {
  const admin = await requireSection("accounts");
  const id = String(form.get("state") ?? "") as PushStateId;
  const phone = normaliseBdPhone(String(form.get("phone") ?? "").slice(0, 20));
  if (!PUSH_DESIGNS.some((d) => d.id === id)) return back({ push: "invalid" });
  if (!phone) return back({ push: "phone", state: id });
  if (isAdminPreview()) back({ push: "sent", state: id });

  let targets: PushTarget[] = [];
  try {
    targets = await supabaseRpc<PushTarget[]>("website_push_targets_for_phone", { p_phone: phone });
  } catch {
    back({ push: "unavailable", state: id });
  }
  if (!targets.length) back({ push: "none", state: id });
  const results = await Promise.all(
    targets.map((t) => {
      const lang = t.lang === "en" ? "en" : "bn";
      // A sample, so it gets its own card instead of replacing a real order update.
      return sendAndReport(t, { ...renderPush(id, sampleContext(id, lang), lang), tag: `sample:${id}` });
    }),
  );
  const ok = results.filter((r) => r.ok).length;
  await logActivity(admin, { section: "accounts", action: "push_design_test", target: id, summary: `Sent the ${id} notification design to a phone ending ${phone.slice(-3)}: ${ok} of ${results.length} accepted` });
  back(ok ? { push: "sent", state: id } : { push: "failed", state: id, status: results.map((r) => r.status || "network").join(",") });
}
