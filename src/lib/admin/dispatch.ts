import "server-only";

import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import { addDays, dhakaToday, type DispatchJob, type SlotId } from "./dispatch-logic";
import { isAdminPreview } from "./preview";

/**
 * Pickup & delivery dispatch data (docs/technical/sql/website_dispatch.sql). Service role only,
 * from the admin server; the database functions keep the Velto Ops task list in step.
 */

export type StaffMember = { id: string; name: string; role: string };
export type DispatchResult = { ok: true } | { ok: false; error: string };

const NOT_INSTALLED = "Pickup & delivery isn't installed in this database yet (docs/technical/sql/website_dispatch.sql).";
const COLUMNS =
  "id,kind,task_id,order_number,source,customer_name,phone,phone_key,address,area,outlet_code,requested,stage,slot_date,slot,assignee_id,assignee_name,trip_key,merged_into,reason,history,created_at,updated_at";

/* ---------- local preview (next dev + VELTO_ADMIN_PREVIEW=1): an in-memory board ---------- */

const PREVIEW_STAFF: StaffMember[] = [
  { id: "00000000-0000-4000-8000-00000000a001", name: "Bappy", role: "manager" },
  { id: "00000000-0000-4000-8000-00000000a002", name: "Monir", role: "manager" },
  { id: "00000000-0000-4000-8000-00000000a003", name: "Oli Ullah", role: "worker" },
];

let previewJobs: DispatchJob[] | null = null;
function previewBoard(): DispatchJob[] {
  if (previewJobs) return previewJobs;
  const today = dhakaToday();
  const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  let n = 0;
  const j = (over: Partial<DispatchJob>): DispatchJob => ({
    id: `00000000-0000-4000-8000-0000000000${String(++n).padStart(2, "0")}`,
    kind: "pickup",
    task_id: null,
    order_number: null,
    source: "website_booking",
    customer_name: "Customer",
    phone: "01700 000000",
    phone_key: `0170000${String(n).padStart(4, "0")}`,
    address: `House ${n}, Road ${n + 2}`,
    area: "Uttara Sector 7",
    outlet_code: null,
    requested: null,
    stage: "new",
    slot_date: null,
    slot: null,
    assignee_id: null,
    assignee_name: null,
    trip_key: null,
    merged_into: null,
    reason: null,
    history: [],
    created_at: ago(n),
    updated_at: ago(n),
    ...over,
  });
  const [bappy, monir] = PREVIEW_STAFF;
  previewJobs = [
    j({ customer_name: "Nadia Rahman", phone: "01712 345678", phone_key: "01712345678", address: "House 12, Road 7", area: "Uttara Sector 7", requested: `Tomorrow ${today}, Afternoon`, created_at: ago(3) }),
    j({ customer_name: "Nadia Rahman", phone: "+880 1712-345678", phone_key: "01712345678", address: "House 12, Road 7", area: "Uttara Sector 7", requested: "Today, Evening", created_at: ago(1) }),
    j({ customer_name: "Tanvir Hasan", phone: "01819 222333", phone_key: "01819222333", address: "House 4, Road 11", area: "Uttara Sector 11", requested: "Today, Morning", created_at: ago(20) }),
    j({ source: "website_quote", customer_name: "Farzana Akter", phone: "01911 444555", phone_key: "01911444555", address: "House 30, Road 2", area: "Uttara Sector 3", requested: null, created_at: ago(50) }),
    j({ customer_name: "Sabbir Ahmed", phone: "01715 666777", phone_key: "01715666777", address: "House 8, Road 5", area: "Uttara Sector 18", stage: "scheduled", slot_date: today, slot: "morning", assignee_id: bappy.id, assignee_name: bappy.name }),
    j({ customer_name: "Rumana Islam", phone: "01716 888999", phone_key: "01716888999", address: "House 2, Road 3", area: "Uttara Sector 11", stage: "scheduled", slot_date: today, slot: "afternoon", assignee_id: monir.id, assignee_name: monir.name }),
    j({ kind: "delivery", source: "ops_order", order_number: "VEL-01952", customer_name: "Tanvir Hasan", phone: "01819 222333", phone_key: "01819222333", address: "House 4, Road 11", area: "Uttara", requested: "Delivery date Tue 29 Sep" }),
    j({ kind: "delivery", source: "ops_order", order_number: "VEL-01948", customer_name: "Mahmud Karim", phone: "01717 121212", phone_key: "01717121212", address: "House 9, Road 1", area: "Uttara", stage: "scheduled", slot_date: today, slot: "evening", assignee_id: bappy.id, assignee_name: bappy.name }),
    j({ kind: "delivery", source: "ops_order", order_number: "VEL-01944", customer_name: "Shirin Sultana", phone: "01718 343434", phone_key: "01718343434", address: "House 21, Road 6", area: "Uttara", requested: "Delivery date " + addDays(today, 1) }),
  ];
  return previewJobs;
}

function previewWrite(id: string, patch: Partial<DispatchJob>, action: string): DispatchResult {
  const board = previewBoard();
  const i = board.findIndex((x) => x.id === id);
  if (i < 0) return { ok: false, error: "not_found" };
  board[i] = { ...board[i], ...patch, updated_at: new Date().toISOString(), history: [...board[i].history, { at: new Date().toISOString(), by: "Preview admin", action }] };
  return { ok: true };
}

/* ---------- reads ---------- */

/** Brings new website requests and Ready orders onto the board, closes what Ops finished, then reads open jobs and the last three days' closed ones. */
export async function getDispatch(): Promise<Loaded<DispatchJob[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewBoard(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    await supabaseRpc("website_dispatch_sync", {});
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    if (/HTTP 404/.test(m)) return { state: "error", message: NOT_INSTALLED };
    console.error("dispatch_sync_failed", m.slice(0, 120));
  }
  try {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const q = new URLSearchParams({
      select: COLUMNS,
      or: `(stage.in.(new,assigned,scheduled),updated_at.gte.${since})`,
      order: "created_at.asc",
      limit: "1000",
    });
    const res = await supabaseFetch(`/rest/v1/website_dispatch_jobs?${q}`, { cache: "no-store" });
    if (res.status === 404) return { state: "error", message: NOT_INSTALLED };
    if (!res.ok) return { state: "error", message: "The pickup & delivery board could not be read right now." };
    return { state: "ok", data: (await res.json()) as DispatchJob[] };
  } catch {
    return { state: "error", message: "The pickup & delivery board could not be read right now." };
  }
}

/** Active Velto Ops staff: the people a pickup or delivery can be given to. */
export async function getStaff(): Promise<StaffMember[]> {
  if (isAdminPreview()) return PREVIEW_STAFF;
  if (!isSupabaseConfigured()) return [];
  try {
    const q = new URLSearchParams({ select: "id,name,role", active: "eq.true", role: "in.(admin,manager,rider,worker)", order: "name.asc" });
    const res = await supabaseFetch(`/rest/v1/profiles?${q}`, { cache: "no-store" });
    if (!res.ok) return [];
    return ((await res.json()) as { id: string; name: string | null; role: string }[])
      .filter((p) => p.name)
      .map((p) => ({ id: p.id, name: p.name!, role: p.role }));
  } catch {
    return [];
  }
}

/* ---------- writes (each one also updates the Ops task, in one transaction) ---------- */

async function rpc(fn: string, args: Record<string, unknown>): Promise<DispatchResult> {
  try {
    const r = await supabaseRpc<{ ok: boolean; error?: string }>(fn, args);
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "failed" };
  } catch (error) {
    console.error("dispatch_write_failed", fn, error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return { ok: false, error: "unavailable" };
  }
}

export function planJob(job: string, person: StaffMember | null, date: string | null, slot: SlotId | null, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const stage = person && date ? "scheduled" : person || date ? "assigned" : "new";
    return previewWrite(job, { assignee_id: person?.id ?? null, assignee_name: person?.name ?? null, slot_date: date, slot, stage }, "planned");
  }
  return rpc("website_dispatch_plan", { p_job: job, p_assignee_id: person?.id ?? null, p_assignee_name: person?.name ?? null, p_slot_date: date, p_slot: slot, p_actor: actor });
}

export function closeJob(job: string, outcome: "done" | "cancelled", reason: string | null, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) return previewWrite(job, { stage: outcome, reason: outcome === "cancelled" ? reason : null }, outcome);
  return rpc("website_dispatch_close", { p_job: job, p_outcome: outcome, p_reason: reason, p_actor: actor });
}

export function mergeJobs(keep: string, remove: string, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) return previewWrite(remove, { stage: "merged", merged_into: keep, reason: "Merged into another request" }, "merged");
  return rpc("website_dispatch_merge", { p_keep: keep, p_remove: remove, p_actor: actor });
}

export function combineJobs(lead: string, other: string, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const board = previewBoard();
    const l = board.find((x) => x.id === lead);
    if (!l) return { ok: false, error: "not_found" };
    const trip = l.trip_key ?? `trip-${lead}`;
    previewWrite(lead, { trip_key: trip }, "combined");
    const stage = l.assignee_id && l.slot_date ? "scheduled" : l.assignee_id || l.slot_date ? "assigned" : "new";
    return previewWrite(other, { trip_key: trip, assignee_id: l.assignee_id, assignee_name: l.assignee_name, slot_date: l.slot_date, slot: l.slot, stage }, "combined");
  }
  return rpc("website_dispatch_combine", { p_lead: lead, p_other: other, p_actor: actor });
}

export function splitJob(job: string, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) return previewWrite(job, { trip_key: null }, "split");
  return rpc("website_dispatch_split", { p_job: job, p_actor: actor });
}

/**
 * A push to the person's phone through the Ops app's own notify-push function, only when they
 * have an active subscription (notify-push falls back to the whole team otherwise). Best effort.
 */
export async function notifyAssignee(userId: string, title: string, body: string) {
  if (isAdminPreview() || !isSupabaseConfigured()) return;
  try {
    const q = new URLSearchParams({ select: "id", user_id: `eq.${userId}`, active: "eq.true", limit: "1" });
    const subs = await supabaseFetch(`/rest/v1/push_subscriptions?${q}`, { cache: "no-store" });
    if (!subs.ok || !((await subs.json()) as unknown[]).length) return;
    const res = await supabaseFetch("/functions/v1/notify-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user: userId, title, body, url: "/" }),
      cache: "no-store",
    });
    if (!res.ok) console.error("dispatch_push_failed", res.status);
  } catch (error) {
    console.error("dispatch_push_failed", error instanceof Error ? error.message.slice(0, 80) : "unknown");
  }
}
