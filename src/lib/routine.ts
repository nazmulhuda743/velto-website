/**
 * Routine pickup (docs/technical/sql/website_routines.sql): the shape the database returns, read
 * defensively, and the manager alert for a new request. Pure (no server imports), so it is unit-tested.
 */

export const ROUTINE_WINDOWS = ["morning", "afternoon", "evening"] as const;
export type RoutineWindow = (typeof ROUTINE_WINDOWS)[number];
export const ROUTINE_SERVICES = ["dry-cleaning", "wash-and-iron", "ironing"] as const;
export type RoutineStatus = "requested" | "active" | "paused" | "declined" | "stopped";

export type Routine = {
  id: string;
  status: RoutineStatus;
  /** 0 = Sunday. */
  weekday: number;
  window: RoutineWindow;
  service: string | null;
  note: string | null;
  reason: string | null;
  /** A change to a routine that is already running, waiting for Velto. */
  change: boolean;
  /** Dhaka day of the next pickup, while active. */
  nextOn: string | null;
};

/** The Command Center's row: the routine plus who it is for. */
export type RoutineRow = Routine & {
  name: string;
  phone: string;
  address: string;
  area: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  orders: number;
  opsStatus: string | null;
};

const STATUSES: RoutineStatus[] = ["requested", "active", "paused", "declined", "stopped"];
const str = (v: unknown) => (typeof v === "string" ? v : null);

export function parseRoutine(v: unknown): Routine | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const status = STATUSES.find((s) => s === o.status);
  const weekday = typeof o.weekday === "number" && Number.isInteger(o.weekday) && o.weekday >= 0 && o.weekday <= 6 ? o.weekday : null;
  const window = ROUTINE_WINDOWS.find((w) => w === o.window);
  if (!str(o.id) || !status || weekday === null || !window) return null;
  return {
    id: str(o.id)!,
    status,
    weekday,
    window,
    service: str(o.service),
    note: str(o.note),
    reason: str(o.reason),
    change: o.change === true,
    nextOn: str(o.nextOn),
  };
}

export function parseRoutineRows(v: unknown): RoutineRow[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const r = parseRoutine(x);
    if (!r) return [];
    const o = x as Record<string, unknown>;
    return [{
      ...r,
      name: str(o.name) ?? "",
      phone: str(o.phone) ?? "",
      address: str(o.address) ?? "",
      area: str(o.area) ?? "",
      createdAt: str(o.createdAt) ?? "",
      decidedAt: str(o.decidedAt),
      decidedBy: str(o.decidedBy),
      orders: typeof o.orders === "number" ? o.orders : 0,
      opsStatus: str(o.opsStatus),
    }];
  });
}

/** Form values → RPC arguments, or null when anything is off. */
export function routineInput(weekday: string, window: string, service: string, note: string) {
  const day = /^[0-6]$/.test(weekday) ? Number(weekday) : null;
  const w = ROUTINE_WINDOWS.find((x) => x === window);
  const s = service ? ROUTINE_SERVICES.find((x) => x === service) : undefined;
  const n = note.trim();
  if (day === null || !w || (service && !s) || n.length > 300) return null;
  return { p_weekday: day, p_window: w, p_service: s ?? null, p_note: n || null };
}

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WINDOWS_EN: Record<RoutineWindow, string> = { morning: "morning", afternoon: "afternoon", evening: "evening" };

/** Managers' phone alert for a new (or changed) routine request. */
export function routinePush(r: Pick<Routine, "weekday" | "window" | "change">, name: string, siteUrl: string) {
  return {
    title: r.change ? "🔁 Routine change requested" : "🔁 New routine pickup request",
    body: `${name.trim().slice(0, 40)} · every ${DAYS_EN[r.weekday]} ${WINDOWS_EN[r.window]}. Confirm on WhatsApp, then activate.`,
    url: `${siteUrl.replace(/\/+$/, "")}/admin/requests#routines`,
  };
}
