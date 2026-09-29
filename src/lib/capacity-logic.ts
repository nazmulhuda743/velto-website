/**
 * Velto Scheduling Engine: the rules the website, the Command Center and staff booking share,
 * with no imports so they are unit-tested on their own (tests/capacity.test.cjs). The numbers
 * (windows, zones, capacity) live in the database (docs/technical/sql/website_capacity.sql);
 * this module only reads and words them.
 */

export type WindowId = "morning" | "afternoon" | "evening" | "night";
export const WINDOW_IDS: readonly WindowId[] = ["morning", "afternoon", "evening", "night"];
export const isWindowId = (v: unknown): v is WindowId => WINDOW_IDS.includes(v as WindowId);

/** Status of one window for one zone and day, as capacity_availability returns it. */
export type SlotStatus = "open" | "few" | "full" | "closed" | "past";
export const bookable = (s: SlotStatus) => s === "open" || s === "few";

export type AvailabilityWindow = { id: WindowId; starts: string; ends: string; left: number; status: SlotStatus };
export type AvailabilityDay = { date: string; windows: AvailabilityWindow[] };
export type Availability = { enabled: boolean; zone: string | null; today: string; days: AvailabilityDay[] };

const STATUSES: readonly SlotStatus[] = ["open", "few", "full", "closed", "past"];
const HHMM = /^\d{2}:\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** capacity_availability's JSON → typed days, dropping anything malformed. */
export function parseAvailability(v: unknown): Availability | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o || o.ok !== true || typeof o.today !== "string" || !ISO.test(o.today)) return null;
  const days = (Array.isArray(o.days) ? o.days : [])
    .map((d) => {
      const x = d && typeof d === "object" ? (d as Record<string, unknown>) : {};
      if (typeof x.date !== "string" || !ISO.test(x.date)) return null;
      const windows = (Array.isArray(x.windows) ? x.windows : [])
        .map((w) => {
          const y = w && typeof w === "object" ? (w as Record<string, unknown>) : {};
          if (!isWindowId(y.id) || typeof y.starts !== "string" || !HHMM.test(y.starts) || typeof y.ends !== "string" || !HHMM.test(y.ends)) return null;
          const status = STATUSES.includes(y.status as SlotStatus) ? (y.status as SlotStatus) : "closed";
          return { id: y.id, starts: y.starts, ends: y.ends, left: Math.max(0, Math.floor(Number(y.left) || 0)), status };
        })
        .filter((w): w is AvailabilityWindow => w !== null);
      return { date: x.date, windows };
    })
    .filter((d): d is AvailabilityDay => d !== null);
  return { enabled: o.enabled === true, zone: typeof o.zone === "string" ? o.zone : null, today: o.today, days };
}

/** "Uttara Sector 7" → 7; 1–18 only. */
export function sectorOf(area: string | null | undefined): number | null {
  const m = /sec(?:tor)?\s*[-#:.]?\s*(\d{1,2})\b/i.exec(area ?? "");
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 18 ? n : null;
}

/** "16:00" → "4 PM", "12:30" → "12:30 PM" (English, for Ops and the English site). */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "9 AM–12 PM"; the same period twice is written once ("12–4 PM"). */
export function windowHours(starts: string, ends: string): string {
  const a = clock(starts);
  const b = clock(ends);
  const [an, ap] = a.split(" ");
  const [bn, bp] = b.split(" ");
  return ap === bp ? `${an}–${bn} ${bp}` : `${a}–${b}`;
}

const WINDOW_NAMES: Record<WindowId, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 29 Sep" for a YYYY-MM-DD, whatever the server's time zone. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** What Velto Ops reads on the task: "Tue 29 Sep, Evening 4–8 PM (window booked)". */
export function opsPickupLabel(date: string, w: { id: WindowId; starts: string; ends: string }, booked: boolean): string {
  return `${shortDate(date)}, ${WINDOW_NAMES[w.id]} ${windowHours(w.starts, w.ends)}${booked ? " (window booked)" : ""}`;
}

export const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Share of capacity used, 0–1 (over-booked counts as 1 for the bar; the number shows the truth). */
export const fill = (used: number, capacity: number) => (capacity > 0 ? Math.min(1, used / capacity) : used > 0 ? 1 : 0);

/** Board row colour: green under 70%, amber to 99%, red when full or over. */
export function loadTone(used: number, capacity: number, blocked: boolean): "ok" | "busy" | "full" | "closed" {
  if (blocked || capacity === 0) return used > 0 ? "full" : "closed";
  const f = used / capacity;
  return f >= 1 ? "full" : f >= 0.7 ? "busy" : "ok";
}

/** Reasons a manager can pick when booking over capacity (free text allowed too). */
export const OVERRIDE_REASONS = [
  "Regular customer, rider agreed",
  "Same building as another stop",
  "Urgent: wedding / event",
  "Extra rider today",
];

export type Zone = { id: string; name: string; sectors: number[]; active: boolean };

/** Sectors in more than one active zone, and sectors 1–18 in none (the board warns about both). */
export function zoneProblems(zones: Zone[]): { overlap: number[]; missing: number[] } {
  const seen = new Map<number, number>();
  for (const z of zones) if (z.active) for (const s of z.sectors) seen.set(s, (seen.get(s) ?? 0) + 1);
  const overlap = [...seen].filter(([, n]) => n > 1).map(([s]) => s).sort((a, b) => a - b);
  const missing = Array.from({ length: 18 }, (_, i) => i + 1).filter((s) => !seen.has(s));
  return { overlap, missing };
}

/** "1-8, 10" → [1..8, 10]; anything outside 1–18 is dropped. */
export function parseSectors(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d{1,2})(?:[-–](\d{1,2}))?$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let s = Math.min(a, b); s <= Math.max(a, b); s++) if (s >= 1 && s <= 18) out.add(s);
  }
  return [...out].sort((x, y) => x - y);
}

/** [1,2,3,4,5,6,7,8,10] → "1–8, 10". */
export function sectorsText(sectors: number[]): string {
  const s = [...new Set(sectors)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j > i ? `${s[i]}–${s[j]}` : String(s[i]));
    i = j;
  }
  return parts.join(", ");
}
