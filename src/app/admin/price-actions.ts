"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { canProposePrices } from "@/lib/admin/permissions";
import { decidePriceChange, getPriceChanges, requestPriceChange, type ChangeKind } from "@/lib/admin/price-changes";
import { taka } from "@/lib/admin/price-diff";
import { requireSection } from "@/lib/admin/session";

/**
 * Price list changes. Managers propose; an Owner approves on the Approvals page, and only then
 * is the Velto Ops price_list changed. An Owner's own proposal is approved as it is made.
 */

const KINDS = new Set<ChangeKind>(["add", "edit", "remove", "restore"]);
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const go = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);
const VERB: Record<ChangeKind, string> = { add: "add", edit: "change", remove: "remove", restore: "restore" };

function refreshSite() {
  // Public price pages read Ops with a 5-minute cache; refresh them now.
  revalidatePath("/", "layout");
}

export async function proposePriceAction(form: FormData) {
  const admin = await requireSection("prices");
  const back = text(form, "back", 300).startsWith("/admin/prices") ? text(form, "back", 300) : "/admin/prices";
  const kind = text(form, "kind", 10) as ChangeKind;
  const priceId = Number(text(form, "priceId", 20)) || null;
  const errorTo = (message: string): never =>
    go(back.split("?")[0], { ...Object.fromEntries(new URLSearchParams(back.split("?")[1] ?? "")), error: message });

  if (!canProposePrices(admin.role)) errorTo("Your role can view prices but not change them.");
  if (!KINDS.has(kind)) errorTo("Unknown change.");
  if (kind !== "add" && !priceId) errorTo("Choose a price to change.");

  const priceType = text(form, "price_type", 10) || "fixed";
  const proposed =
    kind === "add" || kind === "edit"
      ? {
          item_name: text(form, "item_name", 120),
          category: text(form, "category", 60),
          service_category: text(form, "service_category", 20),
          price_type: priceType,
          price: priceType === "poa" ? null : text(form, "price", 12).replace(/[,\s৳]/g, ""),
          item_group: text(form, "item_group", 20) || null,
          hanger: text(form, "hanger", 10) || null,
          note: text(form, "note", 200) || null,
          is_popular: form.get("is_popular") === "on",
        }
      : {};
  const reason = text(form, "reason", 500);

  const made = await requestPriceChange({ kind, priceId, proposed, reason, by: admin });
  if (!made.ok) errorTo(made.message);
  const changeId = (made as { ok: true; data: string }).data;
  const name = (proposed as { item_name?: string }).item_name || text(form, "label", 160) || "an item";
  const priceText = kind === "add" || kind === "edit" ? ` (${taka(priceType === "poa" ? null : Number((proposed as { price?: string }).price), priceType)})` : "";

  if (admin.role === "owner") {
    const done = await decidePriceChange(changeId, "approve", admin.name, "Made by an Owner");
    if (!done.ok) {
      // Leave the request open so it can be reviewed on the Approvals page.
      await logActivity(admin, { section: "prices", action: "price_requested", target: changeId, summary: `Asked to ${VERB[kind]} ${name}${priceText}; applying it failed` });
      errorTo(`Saved as a request, but applying it failed: ${done.message}`);
    }
    refreshSite();
    await logActivity(admin, { section: "prices", action: `price_${kind}`, target: changeId, summary: `${{ add: "Added", edit: "Changed", remove: "Removed", restore: "Restored" }[kind]} ${name}${priceText} (Owner, applied directly)`, detail: { ...proposed, reason } });
    go(back.split("?")[0], { ...Object.fromEntries(new URLSearchParams(back.split("?")[1] ?? "")), saved: "applied" });
  }

  await logActivity(admin, { section: "prices", action: "price_requested", target: changeId, summary: `Asked to ${VERB[kind]} ${name}${priceText}; waiting for an Owner`, detail: { kind, ...proposed, reason } });
  go(back.split("?")[0], { ...Object.fromEntries(new URLSearchParams(back.split("?")[1] ?? "")), saved: "requested" });
}

export async function decidePriceAction(form: FormData) {
  const admin = await requireSection("approvals");
  const id = text(form, "id", 40);
  const decision = text(form, "decision", 10);
  const note = text(form, "note", 500);
  if (!/^[0-9a-f-]{36}$/i.test(id) || (decision !== "approve" && decision !== "reject")) go("/admin/approvals", { error: "Unknown request." });
  if (decision === "reject" && !note) go("/admin/approvals", { error: "Add a short reason when rejecting, so the requester knows what to fix.", open: id });

  const pending = await getPriceChanges("pending", 200);
  const change = pending.state === "ok" ? pending.data.find((c) => c.id === id) : undefined;
  const done = await decidePriceChange(id, decision as "approve" | "reject", admin.name, note);
  if (!done.ok) go("/admin/approvals", { error: done.message, open: id });
  if (decision === "approve") refreshSite();

  const name = change?.proposed.item_name || change?.before?.item_name || "an item";
  await logActivity(admin, {
    section: "approvals",
    action: decision === "approve" ? "price_approved" : "price_rejected",
    target: id,
    summary: `${decision === "approve" ? "Approved" : "Rejected"} ${change?.requested_by_name ?? "a"}'s request to ${VERB[change?.kind ?? "edit"]} ${name}`,
    detail: { note: note || null, kind: change?.kind ?? null },
  });
  go("/admin/approvals", { saved: decision });
}

export async function cancelPriceAction(form: FormData) {
  const admin = await requireSection("prices");
  const id = text(form, "id", 40);
  const pending = await getPriceChanges("pending", 200);
  const change = pending.state === "ok" ? pending.data.find((c) => c.id === id) : undefined;
  if (!change) go("/admin/prices", { error: "That request is no longer waiting." });
  if (change!.requested_by_id !== admin.id && admin.role !== "owner") go("/admin/prices", { error: "Only the person who asked, or an Owner, can withdraw a request." });
  const done = await decidePriceChange(id, "cancel", admin.name, "Withdrawn");
  if (!done.ok) go("/admin/prices", { error: done.message });
  await logActivity(admin, { section: "prices", action: "price_withdrawn", target: id, summary: `Withdrew the request to ${VERB[change!.kind]} ${change!.proposed.item_name || change!.before?.item_name || "an item"}` });
  go("/admin/prices", { saved: "withdrawn" });
}
