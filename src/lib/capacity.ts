import "server-only";

import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "./supabase-server";
import { parseAvailability, sectorOf, type Availability, type WindowId } from "./capacity-logic";
import { isAdminPreview } from "./admin/preview";
import type { Loaded } from "./admin/analytics-data";

/**
 * Pickup & delivery capacity (docs/technical/sql/website_capacity.sql), read and written with
 * the service role from the website server. The same tables are what Velto Ops reads.
 */

export type CapacityConfig = { installed: boolean; enabled: boolean; daysAhead: number; cutoffMinutes: number };
const OFF: CapacityConfig = { installed: false, enabled: false, daysAhead: 7, cutoffMinutes: 120 };

let cached: { at: number; value: CapacityConfig } | null = null;

/** Whether capacity booking is on (cached for 20 s: the switch is flipped rarely, bookings are frequent). */
export async function getCapacityConfig(fresh = false): Promise<CapacityConfig> {
  if (!isSupabaseConfigured()) return OFF;
  if (!fresh && cached && Date.now() - cached.at < 20_000) return cached.value;
  try {
    const res = await supabaseFetch("/rest/v1/capacity_config?select=enabled,days_ahead,cutoff_minutes&limit=1", { cache: "no-store" });
    if (!res.ok) return res.status === 404 ? OFF : (cached?.value ?? OFF);
    const [row] = (await res.json()) as { enabled: boolean; days_ahead: number; cutoff_minutes: number }[];
    const value: CapacityConfig = row
      ? { installed: true, enabled: row.enabled === true, daysAhead: row.days_ahead, cutoffMinutes: row.cutoff_minutes }
      : OFF;
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return cached?.value ?? OFF;
  }
}

/** The zone a sector belongs to (the same lookup the booking function makes). */
export async function zoneForArea(area: string): Promise<string | null> {
  if (!sectorOf(area)) return null;
  try {
    const zone = await supabaseRpc<string | null>("capacity_zone_for", { p_text: area });
    return zone && zone !== "other" ? zone : null;
  } catch {
    return null;
  }
}

/** Pickup availability for the next days in the customer's sector; null when unavailable. */
export async function getPickupAvailability(sector: number): Promise<Availability | null> {
  const area = `Uttara Sector ${sector}`;
  const zone = await zoneForArea(area);
  if (!zone) return null;
  try {
    return parseAvailability(await supabaseRpc("capacity_availability", { p_kind: "pickup", p_zone: zone }));
  } catch {
    return null;
  }
}

/* ---------- the Capacity board ---------- */

export type BoardReservation = {
  ref: string;
  source: "website" | "staff" | "dispatch";
  status: "held" | "done";
  points: number;
  customerName: string | null;
  area: string | null;
  orderNumber: string | null;
  taskRef: string | null;
  over: boolean;
  reason: string | null;
  by: string | null;
  at: string;
};
export type BoardSlot = {
  kind: "pickup" | "delivery";
  zone: string;
  window: WindowId;
  capacity: number;
  used: number;
  blocked: boolean;
  note: string | null;
  override: boolean;
  reservations: BoardReservation[];
};
export type Board = {
  date: string;
  config: { enabled: boolean; days_ahead: number; cutoff_minutes: number; updated_by: string | null; updated_at: string };
  windows: { id: WindowId; starts: string; ends: string; active: boolean }[];
  zones: { id: string; name: string; sectors: number[]; active: boolean }[];
  defaults: { kind: "pickup" | "delivery"; zone: string; window: WindowId; capacity: number }[];
  slots: BoardSlot[];
};

const NOT_INSTALLED = "Capacity isn't installed in this database yet (docs/technical/sql/website_capacity.sql).";

export async function getBoard(date: string): Promise<Loaded<Board>> {
  if (isAdminPreview()) return { state: "ok", data: previewBoard(date), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    // New website bookings reach the dispatch board with their window; closed stops free their place.
    await supabaseRpc("website_dispatch_sync", {}).catch(() => null);
    await supabaseRpc("capacity_sync_jobs", {}).catch(() => null);
    const data = await supabaseRpc<Board>("capacity_board", { p_date: date });
    return { state: "ok", data: { ...data, slots: data.slots ?? [] } };
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return { state: "error", message: /HTTP 404/.test(m) ? NOT_INSTALLED : "The capacity board could not be read right now." };
  }
}

type Result = { ok: true; over?: boolean; reference?: string } | { ok: false; error: string };

async function rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
  try {
    const r = await supabaseRpc<{ ok: boolean; error?: string; over?: boolean; reference?: string; slot?: { over?: boolean } }>(fn, args);
    return r.ok ? { ok: true, over: r.over ?? r.slot?.over, reference: r.reference } : { ok: false, error: r.error ?? "failed" };
  } catch (error) {
    console.error("capacity_write_failed", fn, error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return { ok: false, error: "unavailable" };
  }
}

export function setSlot(date: string, kind: string, zone: string, window: string, capacity: number | null, blocked: boolean, note: string, actor: string) {
  if (isAdminPreview()) return Promise.resolve<Result>({ ok: true });
  return rpc("capacity_set_slot", { p_date: date, p_kind: kind, p_zone: zone, p_window: window, p_capacity: capacity, p_blocked: blocked, p_note: note, p_actor: actor });
}

export function setDefaults(rows: { kind: string; zone: string; window: string; capacity: number }[]) {
  if (isAdminPreview()) return Promise.resolve<Result>({ ok: true });
  return rpc("capacity_set_defaults", { p_rows: rows });
}

export function setZones(rows: { id: string; name: string; sectors: number[]; active: boolean }[]) {
  if (isAdminPreview()) return Promise.resolve<Result>({ ok: true });
  return rpc("capacity_set_zones", { p_rows: rows });
}

export async function setConfig(enabled: boolean, daysAhead: number, cutoffMinutes: number, windows: { id: string; starts: string; ends: string; active: boolean }[], actor: string) {
  if (isAdminPreview()) return { ok: true } as Result;
  const r = await rpc("capacity_set_config", { p_enabled: enabled, p_days: daysAhead, p_cutoff: cutoffMinutes, p_windows: windows, p_actor: actor });
  cached = null;
  return r;
}

/**
 * Staff book a pickup for a customer who asked on WhatsApp or by phone: the same reservation
 * as the website (a full window refuses unless the staff member gives a reason).
 */
export function staffBookPickup(payload: Record<string, unknown>, slot: { date: string; window: string; override?: string }, actor: string) {
  if (isAdminPreview()) return Promise.resolve<Result>({ ok: true, reference: "WEB-PREVIEW1" });
  return rpc("website_book_pickup", {
    p_dedupe_key: `staff-${crypto.randomUUID()}`,
    p_payload: payload,
    p_slot: { ...slot, source: "staff", actor },
  });
}

/* ---------- local preview (next dev + VELTO_ADMIN_PREVIEW=1) ---------- */

function previewBoard(date: string): Board {
  const windows: Board["windows"] = [
    { id: "morning", starts: "09:00", ends: "12:00", active: true },
    { id: "afternoon", starts: "12:00", ends: "16:00", active: true },
    { id: "evening", starts: "16:00", ends: "20:00", active: true },
    { id: "night", starts: "20:00", ends: "22:00", active: false },
  ];
  const zones: Board["zones"] = [
    { id: "s1-8", name: "Sectors 1–8", sectors: [1, 2, 3, 4, 5, 6, 7, 8], active: true },
    { id: "s9-12", name: "Sectors 9–12", sectors: [9, 10, 11, 12], active: true },
    { id: "s13-18", name: "Sectors 13–18", sectors: [13, 14, 15, 16, 17, 18], active: true },
    { id: "other", name: "Other / no sector", sectors: [], active: true },
  ];
  const cap = { morning: 6, afternoon: 6, evening: 7, night: 0 } as const;
  const used: Record<string, number> = { "pickup|s9-12|morning": 6, "pickup|s9-12|afternoon": 4, "pickup|s9-12|evening": 3, "pickup|s1-8|evening": 2, "delivery|s9-12|evening": 5, "delivery|other|afternoon": 2 };
  const names = ["Nadia Rahman", "Tanvir Hasan", "Farzana Akter", "Sabbir Ahmed", "Rumana Islam", "Mahmud Karim", "Shirin Sultana"];
  const slots: BoardSlot[] = [];
  for (const kind of ["pickup", "delivery"] as const)
    for (const z of zones)
      for (const w of windows.filter((x) => x.active)) {
        const n = used[`${kind}|${z.id}|${w.id}`] ?? 0;
        slots.push({
          kind, zone: z.id, window: w.id, capacity: cap[w.id], used: n, blocked: false, note: null, override: false,
          reservations: Array.from({ length: n }, (_, i) => ({
            ref: `preview-${kind}-${z.id}-${w.id}-${i}`, source: i === 0 && kind === "pickup" ? "staff" : kind === "pickup" ? "website" : "dispatch",
            status: "held", points: 1, customerName: names[i % names.length], area: z.id === "other" ? "Uttara" : `Uttara Sector ${z.sectors[i % z.sectors.length]}`,
            orderNumber: kind === "delivery" ? `VEL-0${1940 + i}` : null, taskRef: kind === "pickup" ? `WEB-PREV000${i}` : null,
            over: false, reason: null, by: "Preview", at: new Date().toISOString(),
          })),
        });
      }
  return {
    date,
    config: { enabled: true, days_ahead: 7, cutoff_minutes: 120, updated_by: "Preview", updated_at: new Date().toISOString() },
    windows, zones,
    defaults: (["pickup", "delivery"] as const).flatMap((kind) => zones.flatMap((z) => windows.map((w) => ({ kind, zone: z.id, window: w.id, capacity: cap[w.id] })))),
    slots,
  };
}
