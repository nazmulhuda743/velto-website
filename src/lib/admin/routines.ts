import "server-only";

import { parseRoutineRows, type RoutineRow } from "../routine";
import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import type { DispatchResult } from "./dispatch";
import { isAdminPreview } from "./preview";

const NOT_INSTALLED = "Routine pickups aren't installed in this database yet (docs/technical/sql/website_routines.sql).";

/** Local preview only: a few requests in each state, changed in memory by the actions below. */
let preview: RoutineRow[] | undefined;
function previewRows(): RoutineRow[] {
  if (preview) return preview;
  const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  const base = { note: null, reason: null, change: false, nextOn: null, decidedAt: null, decidedBy: null, opsStatus: null, service: null };
  preview = [
    { ...base, id: "7a0c1f7e-0000-4000-8000-000000000001", status: "requested", weekday: 6, window: "afternoon", service: "wash-and-iron", note: "Gate code 1234", name: "Nusrat Jahan", phone: "01711000001", address: "House 12, Road 7", area: "7", createdAt: ago(0.1), orders: 4 },
    { ...base, id: "7a0c1f7e-0000-4000-8000-000000000002", status: "requested", weekday: 2, window: "evening", change: true, name: "Arif Hossain", phone: "01811505050", address: "House 3, Road 14", area: "11", createdAt: ago(1), orders: 6, opsStatus: "active" },
    { ...base, id: "7a0c1f7e-0000-4000-8000-000000000003", status: "active", weekday: 4, window: "morning", service: "ironing", name: "Farhana Akter", phone: "01911000003", address: "House 40, Road 2", area: "13", createdAt: ago(20), decidedAt: ago(19), decidedBy: "Preview admin", orders: 9, opsStatus: "active", nextOn: null },
    { ...base, id: "7a0c1f7e-0000-4000-8000-000000000004", status: "paused", weekday: 0, window: "afternoon", name: "Imran Kabir", phone: "01611000004", address: "House 8, Road 5", area: "18", createdAt: ago(40), decidedAt: ago(39), decidedBy: "Preview admin", orders: 12, opsStatus: "paused" },
  ];
  return preview;
}

export async function getRoutines(): Promise<Loaded<RoutineRow[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewRows(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: parseRoutineRows(await supabaseRpc("website_routine_list", {})) };
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    console.error("routine_list_failed", m.slice(0, 120) || "unknown");
    return { state: "error", message: /HTTP 404/.test(m) ? NOT_INSTALLED : "Routine pickups couldn't be read right now." };
  }
}

async function call(fn: string, args: Record<string, unknown>): Promise<DispatchResult> {
  try {
    const r = await supabaseRpc<{ ok?: boolean; error?: string }>(fn, args);
    return r?.ok ? { ok: true } : { ok: false, error: r?.error ?? "unavailable" };
  } catch (error) {
    console.error("routine_write_failed", fn, error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return { ok: false, error: "unavailable" };
  }
}

/** Into Velto Ops weekly pickups (or apply a change to one); `price` per run in taka, optional. */
export function activateRoutine(id: string, price: number | null, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const r = previewRows().find((x) => x.id === id);
    if (!r) return { ok: false, error: "not_found" };
    if (r.status !== "requested") return { ok: false, error: "closed" };
    Object.assign(r, { status: "active", change: false, opsStatus: "active", decidedAt: new Date().toISOString(), decidedBy: actor });
    return { ok: true };
  }
  return call("website_routine_activate", { p_id: id, p_price: price, p_actor: actor });
}

export function declineRoutine(id: string, reason: string, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const r = previewRows().find((x) => x.id === id);
    if (!r) return { ok: false, error: "not_found" };
    if (r.status !== "requested") return { ok: false, error: "closed" };
    Object.assign(r, { status: r.change && r.opsStatus === "active" ? "active" : "declined", change: false, reason, decidedAt: new Date().toISOString(), decidedBy: actor });
    return { ok: true };
  }
  return call("website_routine_decline", { p_id: id, p_reason: reason, p_actor: actor });
}
