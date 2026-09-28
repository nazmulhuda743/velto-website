/**
 * Pickup & delivery dispatch: the rules, with no imports so they are unit-tested on their own.
 *
 * A JOB is one stop (a pickup from a website request, or a delivery of a Ready order). A manager
 * gives it a PERSON and a SLOT (a day + Morning / Afternoon / Evening, the same windows the booking
 * form offers). Stops at one place can be COMBINED into one trip. The data lives in
 * website_dispatch_jobs (docs/technical/sql/website_dispatch.sql); this module only reads it.
 *
 * Overlaps it finds, so nothing is done twice or piled onto one person:
 *   - duplicate: the same customer (phone) has more than one open pickup → merge into the first
 *   - same place: a pickup and a delivery (or two stops) for the same phone or address, not yet
 *     on one trip → combine, so one person goes once
 *   - overbooked: one person has more stops in a slot than they can do → move some
 */

export type JobKind = "pickup" | "delivery";
export type Stage = "new" | "assigned" | "scheduled" | "done" | "cancelled" | "merged";
export type SlotId = "morning" | "afternoon" | "evening";

export type DispatchJob = {
  id: string;
  kind: JobKind;
  task_id: string | null;
  order_number: string | null;
  source: "website_booking" | "website_quote" | "ops_order";
  customer_name: string | null;
  phone: string | null;
  phone_key: string | null;
  address: string | null;
  area: string | null;
  outlet_code: string | null;
  requested: string | null;
  stage: Stage;
  slot_date: string | null;
  slot: SlotId | null;
  assignee_id: string | null;
  assignee_name: string | null;
  trip_key: string | null;
  merged_into: string | null;
  reason: string | null;
  history: { at: string; by: string; action: string; detail?: string | null }[];
  created_at: string;
  updated_at: string;
};

/** The windows of the day, as on the booking form and in capacity_windows (ends are the Ops reminder times). */
export const SLOTS: { id: SlotId; label: string; hours: string; end: number }[] = [
  { id: "morning", label: "Morning", hours: "9 AM–12 PM", end: 12 },
  { id: "afternoon", label: "Afternoon", hours: "12–4 PM", end: 16 },
  { id: "evening", label: "Evening", hours: "4–8 PM", end: 20 },
];
export const isSlot = (v: unknown): v is SlotId => SLOTS.some((s) => s.id === v);
export const slotLabel = (id: string | null) => SLOTS.find((s) => s.id === id)?.label ?? "";

/** Stops one person can do in one slot. A combined trip counts once. */
export const DEFAULT_CAPACITY = 8;

export const OPEN_STAGES: readonly Stage[] = ["new", "assigned", "scheduled"];
export const isOpen = (j: Pick<DispatchJob, "stage">) => OPEN_STAGES.includes(j.stage);
/** Waiting for a manager: no person or no slot yet. */
export const needsPlan = (j: DispatchJob) => isOpen(j) && (!j.assignee_id || !j.slot_date);

/** Cancel reasons offered as one tap (free text is allowed too). */
export const CANCEL_REASONS = [
  "Customer cancelled",
  "No answer after 3 calls",
  "Outside Uttara Sectors 1–18",
  "Customer will drop off at the outlet",
  "Test or spam request",
];

const DAY_MS = 86_400_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** YYYY-MM-DD plus n days (calendar days, no time zone involved). */
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Today in Dhaka as YYYY-MM-DD. */
export const dhakaToday = (now = new Date()) => new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);

/**
 * The customer's own choice as a starting point: "Tomorrow Mon 28 Sep, Afternoon",
 * "Today Sun 27 Sep, Evening" or "Tue 29 Sep, Morning" → { date, slot }. Relative words win over
 * the written date (the request may be old); a written day that has passed is ignored.
 */
export function suggestedSlot(requested: string | null, createdAt: string, today: string): { date: string | null; slot: SlotId | null } {
  const text = (requested ?? "").toLowerCase();
  const slot = (SLOTS.find((s) => text.includes(s.id))?.id ?? null) as SlotId | null;
  const created = dhakaToday(new Date(createdAt));
  let date: string | null = null;
  if (/\btoday\b/.test(text)) date = created;
  else if (/\btomorrow\b/.test(text)) date = addDays(created, 1);
  else {
    const m = text.match(/\b(\d{1,2})\s+([a-z]{3})/);
    const month = m ? MONTHS.indexOf(m[2]) : -1;
    if (m && month >= 0) {
      const year = Number(created.slice(0, 4));
      const pad = (n: number) => String(n).padStart(2, "0");
      let iso = `${year}-${pad(month + 1)}-${pad(Number(m[1]))}`;
      // "2 Jan" asked for in December is next year.
      if (iso < created) iso = `${year + 1}-${iso.slice(5)}`;
      date = iso;
    }
  }
  if (date && date < today) date = null;
  return { date, slot };
}

/** "House 12, Road 7" and "house 12 road 7" are the same place (the phone is the stronger match). */
const normAddress = (a: string | null) =>
  (a ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type Overlap =
  | { kind: "duplicate"; keep: DispatchJob; others: DispatchJob[] }
  | { kind: "same_place"; lead: DispatchJob; other: DispatchJob; why: "phone" | "address" }
  | { kind: "overbooked"; person: string; personName: string; date: string; slot: SlotId; stops: number; capacity: number };

/** Stops a person has in one slot: combined trips count once. */
export function stopCount(jobs: DispatchJob[]): number {
  const trips = new Set<string>();
  for (const j of jobs) trips.add(j.trip_key ?? j.id);
  return trips.size;
}

/** All overlaps among open jobs, most pressing first (duplicates, same place, overbooked). */
export function findOverlaps(all: DispatchJob[], capacity = DEFAULT_CAPACITY): Overlap[] {
  const open = all.filter(isOpen);
  const out: Overlap[] = [];

  // 1. The same customer asked for more than one pickup: keep the first, merge the rest.
  const byPhone = new Map<string, DispatchJob[]>();
  for (const j of open) if (j.kind === "pickup" && j.phone_key) byPhone.set(j.phone_key, [...(byPhone.get(j.phone_key) ?? []), j]);
  const duplicated = new Set<string>();
  for (const group of byPhone.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    out.push({ kind: "duplicate", keep: sorted[0], others: sorted.slice(1) });
    for (const j of sorted.slice(1)) duplicated.add(j.id);
  }

  // 2. Two stops at one place (same phone or same address), not on one trip yet.
  const candidates = open.filter((j) => !duplicated.has(j.id));
  const seen = new Set<string>();
  for (let i = 0; i < candidates.length; i++) {
    for (let k = i + 1; k < candidates.length; k++) {
      const a = candidates[i];
      const b = candidates[k];
      if (a.kind === b.kind && a.kind === "pickup") continue; // two pickups for one phone are duplicates, handled above
      if (a.trip_key && a.trip_key === b.trip_key) continue;
      const phone = a.phone_key && a.phone_key === b.phone_key;
      const addrA = normAddress(a.address);
      const address = !phone && addrA.length >= 8 && addrA === normAddress(b.address);
      if (!phone && !address) continue;
      // Only when they could be the same trip: either still unplanned, or planned for the same day.
      if (a.slot_date && b.slot_date && a.slot_date !== b.slot_date) continue;
      const key = [a.id, b.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      // The planned one (or the delivery) leads; the other takes its person and slot.
      const lead = a.slot_date && !b.slot_date ? a : b.slot_date && !a.slot_date ? b : a.kind === "delivery" ? a : b;
      out.push({ kind: "same_place", lead, other: lead === a ? b : a, why: phone ? "phone" : "address" });
    }
  }

  // 3. More stops in one slot than one person can do.
  const bySlot = new Map<string, DispatchJob[]>();
  for (const j of open) {
    if (!j.assignee_id || !j.slot_date || !j.slot) continue;
    const key = `${j.assignee_id}|${j.slot_date}|${j.slot}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), j]);
  }
  for (const [key, jobs] of bySlot) {
    const stops = stopCount(jobs);
    if (stops <= capacity) continue;
    const [person, date, slot] = key.split("|");
    out.push({ kind: "overbooked", person, personName: jobs[0].assignee_name ?? "Someone", date, slot: slot as SlotId, stops, capacity });
  }
  return out;
}

/** The first slot, from `from` onwards, where the person still has room (for "next free slot"). */
export function nextFreeSlot(
  jobs: DispatchJob[],
  person: string,
  from: { date: string; slot: SlotId },
  capacity = DEFAULT_CAPACITY,
  days = 7,
): { date: string; slot: SlotId } | null {
  const open = jobs.filter((j) => isOpen(j) && j.assignee_id === person);
  for (let d = 0; d < days; d++) {
    const date = addDays(from.date, d);
    for (const s of SLOTS) {
      if (d === 0 && SLOTS.findIndex((x) => x.id === s.id) < SLOTS.findIndex((x) => x.id === from.slot)) continue;
      if (stopCount(open.filter((j) => j.slot_date === date && j.slot === s.id)) < capacity) return { date, slot: s.id };
    }
  }
  return null;
}

/** Board lanes for one day: slot × person, each with its stops and load. */
export function dayPlan(jobs: DispatchJob[], date: string, capacity = DEFAULT_CAPACITY) {
  const planned = jobs.filter((j) => isOpen(j) && j.slot_date === date && j.slot && j.assignee_id);
  const people = [...new Map(planned.map((j) => [j.assignee_id!, j.assignee_name ?? "Someone"])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return SLOTS.map((slot) => ({
    slot,
    people: people.map((p) => {
      const stops = planned.filter((j) => j.slot === slot.id && j.assignee_id === p.id);
      const count = stopCount(stops);
      return { person: p, jobs: sortTrips(stops), count, over: count > capacity };
    }),
  }));
}

/** Stops of one combined trip next to each other, the rest by creation time. */
export function sortTrips(jobs: DispatchJob[]): DispatchJob[] {
  return [...jobs].sort((a, b) => (a.trip_key ?? a.id).localeCompare(b.trip_key ?? b.id) || a.created_at.localeCompare(b.created_at));
}

/** "2 h", "3 d": how long a request has waited. */
export function waited(createdAt: string, now = Date.now()) {
  const h = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 3_600_000));
  return h < 1 ? "just now" : h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

/** Short day name for a YYYY-MM-DD ("Mon 28 Sep"), independent of the server's time zone. */
export function dayName(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
}
