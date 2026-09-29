import "server-only";

import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import { addDays, dhakaToday, type DispatchJob, type SlotId } from "./dispatch-logic";
import type { CustomerContext, LinkedOrder } from "./request-flow";
import { isAdminPreview } from "./preview";

/**
 * Pickup & delivery dispatch data (docs/technical/sql/website_dispatch.sql). Service role only,
 * from the admin server; the database functions keep the Velto Ops task list in step.
 */

export type StaffMember = { id: string; name: string; role: string };
export type DispatchResult = { ok: true } | { ok: false; error: string };

const NOT_INSTALLED = "Pickup & delivery isn't installed in this database yet (docs/technical/sql/website_dispatch.sql).";
const COLUMNS =
  "id,kind,task_id,order_number,source,customer_name,phone,phone_key,address,area,outlet_code,requested,stage,slot_date,slot,assignee_id,assignee_name,trip_key,merged_into,reason,contact_attempts,last_contact_at,confirmed_at,confirmed_by,picked_at,history,created_at,updated_at";

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
    contact_attempts: 0,
    last_contact_at: null,
    confirmed_at: null,
    confirmed_by: null,
    picked_at: null,
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
    // One request at each later step, for the Bookings page.
    j({ customer_name: "Arif Hossain", phone: "01811 505050", phone_key: "01811505050", address: "House 5, Road 9", area: "Uttara Sector 9", requested: "Tomorrow, Evening", stage: "confirmed", slot_date: addDays(today, 1), slot: "evening", contact_attempts: 2, confirmed_at: ago(2), confirmed_by: "Preview admin", created_at: ago(6), history: [{ at: ago(4), by: "Preview admin", action: "no answer", detail: "Call attempt 1" }, { at: ago(2), by: "Preview admin", action: "confirmed", detail: "Tomorrow evening" }] }),
    j({ customer_name: "Laila Chowdhury", phone: "01912 606060", phone_key: "01912606060", address: "House 14, Road 4", area: "Uttara Sector 4", stage: "picked", picked_at: ago(3), confirmed_at: ago(26), slot_date: today, slot: "morning", assignee_id: monir.id, assignee_name: monir.name, created_at: ago(30) }),
    j({ customer_name: "Tanvir Hasan", phone: "01819 222333", phone_key: "01819222333", address: "House 4, Road 11", area: "Uttara Sector 11", stage: "picked", picked_at: ago(70), order_number: "VEL-01952", confirmed_at: ago(75), slot_date: addDays(today, -3), slot: "afternoon", assignee_id: bappy.id, assignee_name: bappy.name, created_at: ago(80) }),
    j({ customer_name: "Mahmud Karim", phone: "01717 121212", phone_key: "01717121212", address: "House 9, Road 1", area: "Uttara Sector 1", stage: "picked", picked_at: ago(100), order_number: "VEL-01948", confirmed_at: ago(104), created_at: ago(110) }),
    j({ customer_name: "Sadia Noor", phone: "01713 707070", phone_key: "01713707070", address: "House 3, Road 2", area: "Uttara Sector 6", stage: "picked", picked_at: ago(26), order_number: "VEL-01960", confirmed_at: ago(30), created_at: ago(34) }),
    j({ customer_name: "Kamal Uddin", phone: "01714 808080", phone_key: "01714808080", address: "House 6, Road 8", area: "Uttara Sector 10", stage: "picked", picked_at: ago(200), order_number: "VEL-01921", confirmed_at: ago(210), created_at: ago(220) }),
    j({ kind: "delivery", source: "ops_order", order_number: "VEL-01930", customer_name: "Nusrat Jahan", phone: "01719 454545", phone_key: "01719454545", address: "House 11, Road 3", area: "Uttara", created_at: ago(72) }),
    j({ kind: "delivery", source: "ops_order", order_number: "VEL-01880", customer_name: "Habib Rahman", phone: "01710 565656", phone_key: "01710565656", address: "House 7, Road 12", area: "Uttara", created_at: ago(400) }),
    j({ kind: "delivery", source: "ops_order", order_number: "VEL-01872", customer_name: "Tania Akter", phone: "01711 676767", phone_key: "01711676767", address: "House 19, Road 5", area: "Uttara", created_at: ago(500) }),
    j({ customer_name: "Rahim Mia", phone: "01715 909090", phone_key: "01715909090", area: "Uttara Sector 12", stage: "cancelled", reason: "No answer after 3 calls", contact_attempts: 3, created_at: ago(60) }),
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

export function planJob(job: string, person: StaffMember | null, date: string | null, slot: SlotId | null, actor: string, override?: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const stage = person && date ? "scheduled" : person || date ? "assigned" : "new";
    return previewWrite(job, { assignee_id: person?.id ?? null, assignee_name: person?.name ?? null, slot_date: date, slot, stage }, "planned");
  }
  return rpc("website_dispatch_plan", { p_job: job, p_assignee_id: person?.id ?? null, p_assignee_name: person?.name ?? null, p_slot_date: date, p_slot: slot, p_actor: actor, p_override: override || null });
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
export async function notifyAssignee(userId: string, title: string, body: string, url = "/") {
  if (isAdminPreview() || !isSupabaseConfigured()) return;
  try {
    const q = new URLSearchParams({ select: "id", user_id: `eq.${userId}`, active: "eq.true", limit: "1" });
    const subs = await supabaseFetch(`/rest/v1/push_subscriptions?${q}`, { cache: "no-store" });
    if (!subs.ok || !((await subs.json()) as unknown[]).length) return;
    const res = await supabaseFetch("/functions/v1/notify-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_user: userId, title, body, url }),
      cache: "no-store",
    });
    if (!res.ok) console.error("dispatch_push_failed", res.status);
  } catch (error) {
    console.error("dispatch_push_failed", error instanceof Error ? error.message.slice(0, 80) : "unknown");
  }
}

/**
 * A new website booking or quote: a push to every active Ops admin and manager whose phone is
 * subscribed (people without a subscription are skipped, never the whole team). Best effort; the
 * customer's request is already saved.
 */
export async function notifyNewRequest(push: { title: string; body: string; url: string }) {
  if (isAdminPreview() || !isSupabaseConfigured() || process.env.VELTO_NEW_REQUEST_PUSH === "false") return;
  try {
    const q = new URLSearchParams({ select: "id", active: "eq.true", role: "in.(admin,manager)" });
    const res = await supabaseFetch(`/rest/v1/profiles?${q}`, { cache: "no-store" });
    if (!res.ok) return;
    const people = (await res.json()) as { id: string }[];
    await Promise.all(people.map((p) => notifyAssignee(p.id, push.title, push.body, push.url)));
  } catch (error) {
    console.error("new_request_push_failed", error instanceof Error ? error.message.slice(0, 80) : "unknown");
  }
}

/* ---------- booking requests (/admin/requests): one card per request ---------- */

/**
 * Pickup jobs for the Bookings page (the last 60 days, any stage) and the delivery jobs of the
 * orders linked to them. Runs the same sync as the board first.
 */
export async function getRequestJobs(): Promise<Loaded<{ pickups: DispatchJob[]; deliveries: DispatchJob[] }>> {
  if (isAdminPreview()) {
    const board = previewBoard();
    return { state: "ok", data: { pickups: board.filter((j) => j.kind === "pickup"), deliveries: board.filter((j) => j.kind === "delivery") }, preview: true };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    await supabaseRpc("website_dispatch_sync", {});
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    if (/HTTP 404/.test(m)) return { state: "error", message: NOT_INSTALLED };
    console.error("dispatch_sync_failed", m.slice(0, 120));
  }
  try {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const q = new URLSearchParams({ select: COLUMNS, kind: "eq.pickup", created_at: `gte.${since}`, order: "created_at.desc", limit: "500" });
    const res = await supabaseFetch(`/rest/v1/website_dispatch_jobs?${q}`, { cache: "no-store" });
    if (res.status === 404) return { state: "error", message: NOT_INSTALLED };
    if (!res.ok) return { state: "error", message: "Booking requests could not be read right now." };
    const pickups = (await res.json()) as DispatchJob[];
    const orders = [...new Set(pickups.map((j) => j.order_number).filter((o): o is string => Boolean(o)))];
    let deliveries: DispatchJob[] = [];
    if (orders.length) {
      const dq = new URLSearchParams({ select: COLUMNS, kind: "eq.delivery", order_number: `in.(${orders.join(",")})`, order: "created_at.desc", limit: "500" });
      const dr = await supabaseFetch(`/rest/v1/website_dispatch_jobs?${dq}`, { cache: "no-store" });
      if (dr.ok) deliveries = (await dr.json()) as DispatchJob[];
    }
    return { state: "ok", data: { pickups, deliveries } };
  } catch {
    return { state: "error", message: "Booking requests could not be read right now." };
  }
}

export type RequestContext = { customers: Record<string, CustomerContext>; orders: Record<string, LinkedOrder> };

const PREVIEW_ORDERS: Record<string, LinkedOrder> = {
  "VEL-01952": { status: "Ready", orderDate: null, deliveryDate: dhakaToday(), total: 1450, due: 1450, items: 9, updatedAt: new Date().toISOString() },
  "VEL-01948": { status: "Ready", orderDate: null, deliveryDate: null, total: 820, due: 0, items: 5, updatedAt: new Date().toISOString() },
  "VEL-01960": { status: "Picked", orderDate: null, deliveryDate: null, total: 640, due: 640, items: 4, updatedAt: new Date().toISOString() },
  "VEL-01963": { status: "Picked", orderDate: null, deliveryDate: null, total: 910, due: 910, items: 6, updatedAt: new Date().toISOString() },
  "VEL-01944": { status: "Ready", orderDate: null, deliveryDate: addDays(dhakaToday(), 1), total: 560, due: 560, items: 4, updatedAt: new Date().toISOString() },
  "VEL-01930": { status: "Ready", orderDate: null, deliveryDate: addDays(dhakaToday(), -2), total: 1200, due: 300, items: 7, updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  "VEL-01880": { status: "Ready", orderDate: null, deliveryDate: addDays(dhakaToday(), -15), total: 950, due: 950, items: 6, updatedAt: new Date(Date.now() - 16 * 86_400_000).toISOString() },
  "VEL-01872": { status: "Ready", orderDate: null, deliveryDate: null, total: 420, due: 420, items: 2, updatedAt: new Date(Date.now() - 21 * 86_400_000).toISOString() },
  "VEL-01921": { status: "Delivered", orderDate: null, deliveryDate: null, total: 380, due: 0, items: 3, updatedAt: new Date().toISOString() },
};

/** Each phone's order history in Ops and the linked orders' status. Empty on failure (the cards still work). */
export async function getRequestContext(phoneKeys: string[], orders: string[]): Promise<RequestContext> {
  const empty: RequestContext = { customers: {}, orders: {} };
  if (isAdminPreview()) {
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    // Laila's order was made at the outlet 2 hours ago (a link candidate); Arif is a regular.
    const known: Record<string, CustomerContext> = {
      "01912606060": { orders: 1, lastOrder: null, recent: [{ orderNumber: "VEL-01963", status: "Picked", orderDate: null, createdAt: ago(2) }] },
      "01811505050": { orders: 6, lastOrder: null, recent: [{ orderNumber: "VEL-01702", status: "Delivered", orderDate: null, createdAt: ago(24 * 40) }] },
    };
    return {
      customers: Object.fromEntries(phoneKeys.map((k) => [k, known[k] ?? { orders: 0, lastOrder: null, recent: [] }])),
      orders: Object.fromEntries(orders.filter((o) => PREVIEW_ORDERS[o]).map((o) => [o, PREVIEW_ORDERS[o]])),
    };
  }
  if (!isSupabaseConfigured() || (!phoneKeys.length && !orders.length)) return empty;
  try {
    const r = await supabaseRpc<RequestContext>("website_dispatch_context", { p_phone_keys: phoneKeys.slice(0, 200), p_orders: orders.slice(0, 500) });
    return { customers: r?.customers ?? {}, orders: r?.orders ?? {} };
  } catch (error) {
    console.error("dispatch_context_failed", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return empty;
  }
}

export function contactJob(job: string, outcome: "confirmed" | "no_answer", date: string | null, slot: SlotId | null, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const j = previewBoard().find((x) => x.id === job);
    if (!j) return { ok: false, error: "not_found" };
    if (outcome === "no_answer") return previewWrite(job, { contact_attempts: j.contact_attempts + 1, last_contact_at: new Date().toISOString() }, "no answer");
    return previewWrite(
      job,
      { contact_attempts: j.contact_attempts + 1, confirmed_at: new Date().toISOString(), confirmed_by: "Preview admin", slot_date: date, slot, stage: j.assignee_id ? "scheduled" : "confirmed" },
      "confirmed",
    );
  }
  return rpc("website_dispatch_contact", { p_job: job, p_outcome: outcome, p_slot_date: date, p_slot: slot, p_actor: actor });
}

export function noteJob(job: string, kind: "note" | "whatsapp", text: string, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) {
    const board = previewBoard();
    const i = board.findIndex((x) => x.id === job);
    if (i < 0) return { ok: false, error: "not_found" };
    board[i] = { ...board[i], history: [...board[i].history, { at: new Date().toISOString(), by: "Preview admin", action: kind, detail: text }] };
    return { ok: true };
  }
  return rpc("website_dispatch_note", { p_job: job, p_kind: kind, p_text: text, p_actor: actor });
}

export function pickJob(job: string, orderNumber: string | null, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) return previewWrite(job, { stage: "picked", picked_at: new Date().toISOString(), ...(orderNumber ? { order_number: orderNumber } : {}) }, "picked up");
  return rpc("website_dispatch_pick", { p_job: job, p_order_number: orderNumber, p_actor: actor });
}

export function linkOrder(job: string, orderNumber: string | null, actor: string): Promise<DispatchResult> | DispatchResult {
  if (isAdminPreview()) return previewWrite(job, { order_number: orderNumber }, orderNumber ? "order linked" : "order unlinked");
  return rpc("website_dispatch_link_order", { p_job: job, p_order_number: orderNumber, p_actor: actor });
}
