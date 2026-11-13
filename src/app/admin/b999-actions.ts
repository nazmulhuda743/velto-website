"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { cancelB999, decideB999, flagB999, linkB999Order } from "@/lib/admin/b999";
import { isAdminPreview } from "@/lib/admin/preview";
import { requireSection } from "@/lib/admin/session";
import { b999AfterDecline, b999Total } from "@/lib/campaigns/b999";

/**
 * Admin → Blanket ৳999: staff record a price check and the customer's answer. The total never
 * changes without a recorded approval (website_b999_flag / website_b999_decide).
 */
const PAGE = "/admin/b999";
const back = (params: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(params)}#b${params.id ?? ""}`);
const num = (form: FormData, key: string, max: number) => Math.max(0, Math.min(max, Math.floor(Number(form.get(key) ?? 0) || 0)));
const id = (form: FormData) => {
  const v = String(form.get("id") ?? "");
  return /^[0-9a-f-]{36}$/i.test(v) ? v : "";
};

export async function flagB999Action(form: FormData) {
  const admin = await requireSection("dispatch");
  const bid = id(form);
  const c = { regular: num(form, "regular", 3), heavy: num(form, "heavy", 3), extraRegular: num(form, "extraRegular", 30), extraHeavy: num(form, "extraHeavy", 30) };
  if (!bid || c.regular + c.heavy > 3) back({ error: "The 3-pack has at most 3 blankets (regular + heavy).", id: bid });
  const total = b999Total(c).total;
  if (isAdminPreview()) back({ saved: "flagged", id: bid });
  const r = await flagB999(bid, c, total, String(form.get("note") ?? "").slice(0, 500), admin.name).catch(() => null);
  if (!r?.ok) back({ error: r?.error === "decided" ? "This price was already decided." : "Couldn't save. Try again.", id: bid });
  await logActivity(admin, { section: "dispatch", action: "b999_price_check", target: bid, summary: `B999 booking needs a price check: proposed ৳${total}`, detail: { ...c, total } }).catch(() => null);
  back({ saved: "flagged", id: bid });
}

export async function decideB999Action(form: FormData) {
  const admin = await requireSection("dispatch");
  const bid = id(form);
  const decision = form.get("decision") === "declined" ? "declined" : form.get("decision") === "approved" ? "approved" : null;
  const channel = String(form.get("channel") ?? "");
  if (!bid || !decision || !["phone", "whatsapp", "in_person"].includes(channel)) back({ error: "Choose how the customer answered.", id: bid });
  const counts = { regular: num(form, "regular", 3), heavy: num(form, "heavy", 3), extraRegular: num(form, "extraRegular", 30), extraHeavy: num(form, "extraHeavy", 30) };
  const declinedHeavy = decision === "declined" ? num(form, "declinedHeavy", 3) : 0;
  const total = decision === "declined" ? b999AfterDecline(counts, declinedHeavy).total : null;
  if (isAdminPreview()) back({ saved: decision!, id: bid });
  const r = await decideB999(bid, decision!, channel, declinedHeavy, total, admin.name).catch(() => null);
  if (!r?.ok) back({ error: "Couldn't save the answer. Try again.", id: bid });
  await logActivity(admin, { section: "dispatch", action: `b999_${decision}`, target: bid, summary: decision === "approved" ? "B999: customer approved the new price" : `B999: customer declined ${declinedHeavy} heavy blanket(s), now ৳${total}`, detail: { channel, declinedHeavy, total } }).catch(() => null);
  back({ saved: decision!, id: bid });
}

export async function linkB999OrderAction(form: FormData) {
  await requireSection("dispatch");
  const bid = id(form);
  const order = String(form.get("order") ?? "").trim().toUpperCase().slice(0, 20);
  if (!bid || !/^VELR?-\d{5}$/.test(order)) back({ error: "Enter the Ops order number, for example VEL-01234.", id: bid });
  if (isAdminPreview()) back({ saved: "linked", id: bid });
  const r = await linkB999Order(bid, order).catch(() => null);
  if (!r?.ok) back({ error: r?.error === "no_order" ? "No Ops order has that number." : "Couldn't link. Try again.", id: bid });
  back({ saved: "linked", id: bid });
}

export async function cancelB999Action(form: FormData) {
  const admin = await requireSection("dispatch");
  const bid = id(form);
  if (!bid) back({ error: "Unknown booking." });
  if (isAdminPreview()) back({ saved: "cancelled", id: bid });
  const r = await cancelB999(bid, admin.name).catch(() => null);
  if (!r?.ok) back({ error: "Couldn't cancel. Try again.", id: bid });
  await logActivity(admin, { section: "dispatch", action: "b999_cancel", target: bid, summary: "B999 booking cancelled" }).catch(() => null);
  back({ saved: "cancelled", id: bid });
}
