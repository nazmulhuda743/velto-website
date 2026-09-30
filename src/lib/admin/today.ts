import "server-only";

import type { RoutineRow } from "../routine";
import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import { getCallbacks, type CallbackRow } from "./callbacks";
import { getDispatch, getRequestContext, getStaff, JOB_COLUMNS, readStaff, type DispatchResult, type RequestContext } from "./dispatch";
import { addDays, DEFAULT_CAPACITY, dhakaToday, type DispatchJob, type SlotId } from "./dispatch-logic";
import { isAdminPreview } from "./preview";
import { getRoutines } from "./routines";
import { linkCandidates, type OrderCandidate, type Rider } from "./today-logic";

/**
 * The Today screen's data (/admin/today, spec docs/superpowers/specs/2026-10-01-today-scheduling-design.md):
 * the board after a sync and an auto-link, who can ride that day (website_riders and
 * website_rider_days_off, docs/technical/sql/website_today.sql), open call-backs, routine requests
 * to confirm, and the Ops orders a picked-up request could belong to. Service role only. Nothing
 * here throws: a missing table or an unreachable Ops degrades to the old behaviour or an error state.
 */

type Fetcher = typeof supabaseFetch;

export type TodayData = {
  jobs: DispatchJob[];
  riders: Rider[];
  context: RequestContext;
  /** Open "Get a call back" requests (Call tab, Call-back badge). */
  callbacks: CallbackRow[];
  /** Weekly routine requests waiting to be confirmed (Call tab, Weekly badge). */
  routines: RoutineRow[];
  /** "Which order?": for each picked pickup with no order, the Ops orders it could be (oldest first). */
  candidates: Record<string, OrderCandidate[]>;
  loadedAt: string;
};

/** Error codes the Today actions send back as `?error=`; the page shows them in the chosen language. */
export const TODAY_ERRORS = {
  invalid: "Check the day and time window and try again.",
  past: "That day has already passed. Choose today or later.",
  not_found: "That job no longer exists. The list has been refreshed.",
  closed: "That job has already moved on. The list has been refreshed.",
  assignee: "That person can't take pickups and deliveries (Riders & windows).",
  off: "That rider is off that day.",
  full: "That rider is full in that window. Assign anyway?",
  order: "There is no order with that number in Velto Ops yet.",
  order_format: "Order numbers look like VEL-01952.",
  order_taken: "That order is already linked to another pickup.",
  role: "Only an Owner or Manager can change riders.",
  not_installed: "Riders & windows aren't installed in this database yet (docs/technical/sql/website_today.sql).",
  slot_full: "That window is full for this area (Capacity).",
  slot_closed: "That window is blocked or closed for this area (Capacity).",
  slot_past: "That window has already passed.",
  unavailable: "Can't reach Velto Ops right now. Nothing was changed; try again.",
} as const;
export type TodayError = keyof typeof TODAY_ERRORS;

/** The same in Bangla (DRAFT for owner review, like the rest of the Today Bangla: docs/content/BANGLA-REVIEW.md). */
export const TODAY_ERRORS_BN: Record<TodayError, string> = {
  invalid: "দিন আর সময় ঠিক করে আবার চেষ্টা করুন।",
  past: "এই দিন পার হয়ে গেছে। আজ বা পরের কোনো দিন বাছুন।",
  not_found: "এই কাজটা আর নেই। তালিকা রিফ্রেশ করা হয়েছে।",
  closed: "এই কাজটা আগেই এগিয়ে গেছে। তালিকা রিফ্রেশ করা হয়েছে।",
  assignee: "এই ব্যক্তি পিকআপ-ডেলিভারি নেন না (রাইডার সেটিংস)।",
  off: "এই রাইডার সেদিন ছুটিতে।",
  full: "এই সময়ে রাইডার পূর্ণ। তবুও দেবেন?",
  order: "Velto Ops-এ এই নম্বরের কোনো অর্ডার এখনো নেই।",
  order_format: "অর্ডার নম্বর এমন হয়: VEL-01952।",
  order_taken: "এই অর্ডার আরেকটা পিকআপের সাথে যুক্ত।",
  role: "শুধু Owner বা Manager রাইডার বদলাতে পারেন।",
  not_installed: "রাইডার সেটিংস এখনো ডাটাবেজে চালু হয়নি (docs/technical/sql/website_today.sql)।",
  slot_full: "এই এলাকায় এই সময় পূর্ণ (Capacity)।",
  slot_closed: "এই এলাকায় এই সময় বন্ধ (Capacity)।",
  slot_past: "এই সময় পার হয়ে গেছে।",
  unavailable: "এখন Velto Ops-এ যাওয়া যাচ্ছে না। কিছু বদলায়নি; আবার চেষ্টা করুন।",
};

/** An error code's text in the page's language. */
export const todayError = (code: TodayError, lang: "en" | "bn") => (lang === "bn" ? TODAY_ERRORS_BN : TODAY_ERRORS)[code];

const NOT_INSTALLED = "Pickup & delivery isn't installed in this database yet (docs/technical/sql/website_dispatch.sql).";
const UNREACHABLE = "Can't reach Velto Ops right now.";
/** A real calendar day as YYYY-MM-DD (2026-02-31 is not one). */
export function isDay(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}
const stops = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 30 ? n : DEFAULT_CAPACITY);

/* ---------- local preview (next dev + VELTO_ADMIN_PREVIEW=1): riders in memory ---------- */

type Setting = { canRide: boolean; stopsPerWindow: number };
let previewSettings: Map<string, Setting> | null = null;
let previewOff: Set<string> | null = null;
async function previewRiderState() {
  const staff = await getStaff();
  if (!previewSettings || !previewOff) {
    const [bappy, monir, oli] = staff;
    const today = dhakaToday();
    // Bappy does one stop a window (full in the morning: he has a pickup then); Oli is off today, Monir tomorrow.
    previewSettings = new Map([
      [bappy.id, { canRide: true, stopsPerWindow: 1 }],
      [monir.id, { canRide: true, stopsPerWindow: 8 }],
      [oli.id, { canRide: true, stopsPerWindow: 8 }],
    ]);
    previewOff = new Set([`${oli.id}|${today}`, `${monir.id}|${addDays(today, 1)}`]);
  }
  return { staff, settings: previewSettings, off: previewOff };
}

/* ---------- riders ---------- */

/** A table read: its rows, or null when it is missing or can't be read (the caller falls back). */
async function readRows<T>(fetcher: Fetcher, path: string): Promise<T[] | null> {
  try {
    const res = await fetcher(path, { cache: "no-store" });
    if (!res.ok) {
      // 404: website_today.sql isn't applied yet, which is expected until it is.
      if (res.status !== 404) console.error("today_read_failed", path.split("?")[0], res.status);
      return null;
    }
    const rows = (await res.json()) as unknown;
    return Array.isArray(rows) ? (rows as T[]) : null;
  } catch (error) {
    console.error("today_read_failed", path.split("?")[0], error instanceof Error ? error.message.slice(0, 80) : "unknown");
    return null;
  }
}

type RiderRow = { profile_id: string; can_ride: boolean; stops_per_window: number };

/**
 * Who can take stops on `date`: active Ops staff ticked "Can do pickups & deliveries", with their
 * stops per window and whether they are off. Until anyone is ticked (or when the table is missing
 * or unreadable), every active staff member is offered at 8 stops, as before riders existed.
 */
export async function getRiders(date: string, fetcher: Fetcher = supabaseFetch): Promise<Rider[]> {
  const day = isDay(date) ? date : dhakaToday();
  if (isAdminPreview()) {
    const { staff, settings, off } = await previewRiderState();
    const ticked = staff.filter((p) => settings.get(p.id)?.canRide);
    return (ticked.length ? ticked : staff).map((p) => ({ id: p.id, name: p.name, stopsPerWindow: settings.get(p.id)?.stopsPerWindow ?? DEFAULT_CAPACITY, off: off.has(`${p.id}|${day}`) }));
  }
  const staff = await getStaff(fetcher);
  if (!staff.length) return [];
  const [rows, daysOff] = await Promise.all([
    readRows<RiderRow>(fetcher, `/rest/v1/website_riders?${new URLSearchParams({ select: "profile_id,can_ride,stops_per_window" })}`),
    readRows<{ profile_id: string }>(fetcher, `/rest/v1/website_rider_days_off?${new URLSearchParams({ select: "profile_id", day: `eq.${day}` })}`),
  ]);
  const settings = new Map((rows ?? []).map((r) => [r.profile_id, r]));
  const off = new Set((daysOff ?? []).map((r) => r.profile_id));
  const ticked = staff.filter((p) => settings.get(p.id)?.can_ride === true);
  return (ticked.length ? ticked : staff).map((p) => ({ id: p.id, name: p.name, stopsPerWindow: stops(settings.get(p.id)?.stops_per_window), off: off.has(p.id) }));
}

export type RiderSetting = { id: string; name: string; role: string; canRide: boolean; stopsPerWindow: number; offToday: boolean; offTomorrow: boolean };

/** Riders & windows settings: every active staff member with their switches (for the settings page). */
export async function getRiderSettings(): Promise<Loaded<{ people: RiderSetting[]; anyTicked: boolean; installed: boolean }>> {
  const today = dhakaToday();
  const tomorrow = addDays(today, 1);
  if (isAdminPreview()) {
    const { staff, settings, off } = await previewRiderState();
    const people = staff.map((p) => ({
      ...p,
      canRide: settings.get(p.id)?.canRide ?? false,
      stopsPerWindow: settings.get(p.id)?.stopsPerWindow ?? DEFAULT_CAPACITY,
      offToday: off.has(`${p.id}|${today}`),
      offTomorrow: off.has(`${p.id}|${tomorrow}`),
    }));
    return { state: "ok", data: { people, anyTicked: people.some((p) => p.canRide), installed: true }, preview: true };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  const staff = await readStaff();
  if (!staff) return { state: "error", message: "Velto Ops staff couldn't be read right now." };
  const [rows, daysOff] = await Promise.all([
    readRows<RiderRow>(supabaseFetch, `/rest/v1/website_riders?${new URLSearchParams({ select: "profile_id,can_ride,stops_per_window" })}`),
    readRows<{ profile_id: string; day: string }>(supabaseFetch, `/rest/v1/website_rider_days_off?${new URLSearchParams({ select: "profile_id,day", day: `in.(${today},${tomorrow})` })}`),
  ]);
  const settings = new Map((rows ?? []).map((r) => [r.profile_id, r]));
  const off = new Set((daysOff ?? []).map((r) => `${r.profile_id}|${r.day}`));
  const people = staff.map((p) => ({
    ...p,
    canRide: settings.get(p.id)?.can_ride === true,
    stopsPerWindow: stops(settings.get(p.id)?.stops_per_window),
    offToday: off.has(`${p.id}|${today}`),
    offTomorrow: off.has(`${p.id}|${tomorrow}`),
  }));
  return { state: "ok", data: { people, anyTicked: people.some((p) => p.canRide), installed: rows !== null } };
}

/** Ticks "Can do pickups & deliveries" and sets stops per window (1–30). Safe to repeat. */
export async function saveRider(profileId: string, canRide: boolean, stopsPerWindow: number, actor: string): Promise<DispatchResult> {
  if (isAdminPreview()) {
    const { settings } = await previewRiderState();
    settings.set(profileId, { canRide, stopsPerWindow });
    return { ok: true };
  }
  return write("/rest/v1/website_riders?on_conflict=profile_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ profile_id: profileId, can_ride: canRide, stops_per_window: stopsPerWindow, updated_at: new Date().toISOString(), updated_by: actor.slice(0, 120) }),
  });
}

/** Off (or back on) for one day. Safe to repeat. */
export async function setDayOff(profileId: string, day: string, off: boolean): Promise<DispatchResult> {
  if (isAdminPreview()) {
    const { off: days } = await previewRiderState();
    if (off) days.add(`${profileId}|${day}`);
    else days.delete(`${profileId}|${day}`);
    return { ok: true };
  }
  if (off) {
    return write("/rest/v1/website_rider_days_off?on_conflict=profile_id,day", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ profile_id: profileId, day }),
    });
  }
  return write(`/rest/v1/website_rider_days_off?${new URLSearchParams({ profile_id: `eq.${profileId}`, day: `eq.${day}` })}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

async function write(path: string, init: RequestInit): Promise<DispatchResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "unavailable" };
  try {
    const res = await supabaseFetch(path, { ...init, cache: "no-store" });
    if (res.ok) return { ok: true };
    console.error("today_write_failed", path.split("?")[0], res.status);
    return { ok: false, error: res.status === 404 ? "not_installed" : "unavailable" };
  } catch (error) {
    console.error("today_write_failed", path.split("?")[0], error instanceof Error ? error.message.slice(0, 80) : "unknown");
    return { ok: false, error: "unavailable" };
  }
}

/* ---------- jobs ---------- */

/** One job as it is now: null when it doesn't exist, undefined when it couldn't be read. */
export async function getJob(id: string): Promise<DispatchJob | null | undefined> {
  if (isAdminPreview()) {
    const board = await getDispatch();
    return board.state === "ok" ? (board.data.find((j) => j.id === id) ?? null) : undefined;
  }
  if (!isSupabaseConfigured()) return undefined;
  const rows = await readRows<DispatchJob>(supabaseFetch, `/rest/v1/website_dispatch_jobs?${new URLSearchParams({ select: JOB_COLUMNS, id: `eq.${id}`, limit: "1" })}`);
  return rows ? (rows[0] ?? null) : undefined;
}

/** Whether `order` is already linked to a pickup other than `job` (false when that can't be read: the link function decides). */
export async function orderLinkedElsewhere(order: string, job: string): Promise<boolean> {
  if (isAdminPreview()) {
    const board = await getDispatch();
    return board.state === "ok" && board.data.some((j) => j.kind === "pickup" && j.order_number === order && j.id !== job);
  }
  if (!isSupabaseConfigured()) return false;
  const q = new URLSearchParams({ select: "id", kind: "eq.pickup", order_number: `eq.${order}`, id: `neq.${job}`, limit: "1" });
  return Boolean((await readRows<{ id: string }>(supabaseFetch, `/rest/v1/website_dispatch_jobs?${q}`))?.length);
}

/** Scheduled stops in one window of one day (for a rider's load); null when they couldn't be read. */
export async function getWindowStops(date: string, slot: SlotId): Promise<DispatchJob[] | null> {
  if (isAdminPreview()) {
    const board = await getDispatch();
    return board.state === "ok" ? board.data.filter((j) => j.stage === "scheduled" && j.slot_date === date && j.slot === slot) : null;
  }
  if (!isSupabaseConfigured()) return null;
  const q = new URLSearchParams({ select: JOB_COLUMNS, stage: "eq.scheduled", slot_date: `eq.${date}`, slot: `eq.${slot}`, limit: "1000" });
  return readRows<DispatchJob>(supabaseFetch, `/rest/v1/website_dispatch_jobs?${q}`);
}

/** Best-effort database function call; a 404 (not installed yet) is expected and not logged. */
async function tryRpc(fn: string): Promise<"ok" | "missing" | "failed"> {
  try {
    await supabaseRpc(fn, {});
    return "ok";
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    if (/HTTP 404/.test(m)) return "missing";
    console.error("today_rpc_failed", fn, m.slice(0, 120));
    return "failed";
  }
}

/** Open work, the last three days' finished jobs, and picked pickups of the last week still without an order. */
async function readBoard(): Promise<Loaded<DispatchJob[]>> {
  if (isAdminPreview()) return getDispatch();
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  // Opening Today syncs, like the old board (pg_cron also runs both every 5 minutes).
  if ((await tryRpc("website_dispatch_sync")) === "missing") return { state: "error", message: NOT_INSTALLED };
  await tryRpc("website_dispatch_autolink");
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const q = new URLSearchParams({
    select: JOB_COLUMNS,
    or: `(stage.in.(new,confirmed,assigned,scheduled),updated_at.gte.${since},and(kind.eq.pickup,stage.eq.picked,order_number.is.null,picked_at.gte.${week}))`,
    order: "created_at.asc",
    limit: "1000",
  });
  try {
    const res = await supabaseFetch(`/rest/v1/website_dispatch_jobs?${q}`, { cache: "no-store" });
    if (res.status === 404) return { state: "error", message: NOT_INSTALLED };
    if (!res.ok) return { state: "error", message: UNREACHABLE };
    return { state: "ok", data: (await res.json()) as DispatchJob[] };
  } catch {
    return { state: "error", message: UNREACHABLE };
  }
}

/** Order numbers among `orders` already linked to a pickup job (so not offered again). */
async function linkedOrders(orders: string[]): Promise<Set<string>> {
  if (!orders.length || isAdminPreview()) return new Set();
  const q = new URLSearchParams({ select: "id,order_number", kind: "eq.pickup", order_number: `in.(${orders.join(",")})` });
  const rows = await readRows<{ order_number: string }>(supabaseFetch, `/rest/v1/website_dispatch_jobs?${q}`);
  return new Set((rows ?? []).map((r) => r.order_number));
}

const needsOrder = (j: DispatchJob) => j.kind === "pickup" && j.stage === "picked" && !j.order_number;

/** Everything the Today page shows for `date` (YYYY-MM-DD, Dhaka). */
export async function getToday(date: string): Promise<Loaded<TodayData>> {
  const day = isDay(date) ? date : dhakaToday();
  const board = await readBoard();
  if (board.state !== "ok") return board;
  const jobs = board.data;
  const [riders, callbacks, routines] = await Promise.all([getRiders(day), getCallbacks(), getRoutines()]);

  // The phones of pickups waiting for their order first, so the context's 200-phone limit never drops them.
  const phones = [...new Set([...jobs.filter(needsOrder), ...jobs].map((j) => j.phone_key).filter((k): k is string => Boolean(k)))];
  const orders = [...new Set(jobs.map((j) => j.order_number).filter((o): o is string => Boolean(o)))];
  const context = await getRequestContext(phones, orders);

  const loaded = new Set(jobs.filter((j) => j.kind === "pickup" && j.order_number).map((j) => j.order_number!));
  const waiting = jobs.filter(needsOrder);
  const first = waiting.flatMap((j) => linkCandidates(j, context.customers[j.phone_key ?? ""]?.recent, loaded).map((o) => o.orderNumber));
  const taken = new Set([...loaded, ...(await linkedOrders([...new Set(first)]))]);
  const candidates: Record<string, OrderCandidate[]> = {};
  for (const j of waiting) {
    const found = linkCandidates(j, context.customers[j.phone_key ?? ""]?.recent, taken);
    if (found.length) candidates[j.id] = found;
  }

  return {
    state: "ok",
    data: {
      jobs,
      riders,
      context,
      callbacks: callbacks.state === "ok" ? callbacks.data.filter((c) => c.status === "open") : [],
      routines: routines.state === "ok" ? routines.data.filter((r) => r.status === "requested") : [],
      candidates,
      loadedAt: new Date().toISOString(),
    },
    ...(board.preview ? { preview: true } : {}),
  };
}
