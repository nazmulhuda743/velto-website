import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import type { DispatchResult } from "./dispatch";
import { isAdminPreview } from "./preview";

/** A "Get a call back" request from the booking form (docs/technical/sql/website_callbacks.sql). */
export type CallbackRow = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  area: string | null;
  what: string | null;
  services: string | null;
  preferred: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string | null;
  referrer_host: string | null;
  device: string | null;
  status: "open" | "done";
  outcome: string | null;
  note: string | null;
  handled_by: string | null;
  handled_at: string | null;
  orders: number;
};

const NOT_INSTALLED = "Call-back requests aren't installed in this database yet (docs/technical/sql/website_callbacks.sql).";

let preview: CallbackRow[] | undefined;
function previewRows(): CallbackRow[] {
  if (preview) return preview;
  const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const base = { utm_source: null, utm_medium: null, utm_campaign: null, landing_page: "/", referrer_host: null, device: "mobile", status: "open" as const, outcome: null, note: null, handled_by: null, handled_at: null };
  preview = [
    { ...base, id: "5c1b0000-0000-4000-8000-000000000001", created_at: ago(12), name: "Sadia Rahman", phone: "01711000011", area: "Uttara Sector 7", what: "2 sarees, 1 blazer", services: "Dry Cleaning", preferred: "Tomorrow Wed 30 Sep, Evening 4–8 PM", utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "puja26", orders: 0 },
    { ...base, id: "5c1b0000-0000-4000-8000-000000000002", created_at: ago(48), name: "Imran Kabir", phone: "01811000022", area: "Uttara Sector 11", what: null, services: null, preferred: null, referrer_host: "google.com", device: "desktop", orders: 7 },
    { ...base, id: "5c1b0000-0000-4000-8000-000000000003", created_at: ago(60 * 26), name: "Lamia S.", phone: "01911000033", area: null, what: "curtains", services: "Curtain Cleaning", preferred: null, status: "done", outcome: "booked", note: "Booked for Thursday morning", handled_by: "Preview admin", handled_at: ago(60 * 25), orders: 1 },
  ];
  return preview;
}

export async function getCallbacks(): Promise<Loaded<CallbackRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewRows(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const rows = await supabaseRpc<CallbackRow[]>("website_callback_list", {});
    return { state: "ok", data: Array.isArray(rows) ? rows : [] };
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    console.error("callback_list_failed", m.slice(0, 120) || "unknown");
    return { state: "error", message: /HTTP 404/.test(m) ? NOT_INSTALLED : "Call-back requests couldn't be read right now." };
  }
}

export async function closeCallback(id: string, outcome: string, note: string, actor: string): Promise<DispatchResult> {
  if (isAdminPreview()) {
    const r = previewRows().find((x) => x.id === id);
    if (!r) return { ok: false, error: "not_found" };
    if (r.status !== "open") return { ok: false, error: "closed" };
    Object.assign(r, { status: "done", outcome, note: note || null, handled_by: actor, handled_at: new Date().toISOString() });
    return { ok: true };
  }
  try {
    const r = await supabaseRpc<{ ok?: boolean; error?: string }>("website_callback_close", { p_id: id, p_outcome: outcome, p_note: note || null, p_actor: actor });
    return r?.ok ? { ok: true } : { ok: false, error: r?.error ?? "unavailable" };
  } catch (error) {
    console.error("callback_close_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return { ok: false, error: "unavailable" };
  }
}
