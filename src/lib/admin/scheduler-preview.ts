/** Synthetic local visual fixtures. Never enabled outside next dev. */
import {
  active,
  dhakaDate,
  exactInterval,
  overlaps,
  type Appointment,
  type SchedulerBoard,
  type SchedulerResult,
  type SearchResult,
} from "../scheduler/logic";
const people = [
  { id: "rider-1", name: "Monir", role: "manager", can_ride: true, off: false },
  { id: "rider-2", name: "Rakib", role: "manager", can_ride: true, off: false },
  { id: "worker-1", name: "Oli", role: "worker", can_ride: false, off: false },
];
const customers = [
  {
    id: "customer-1",
    customer_code: "C-001",
    name: "Rahim Ahmed",
    phone: "01711000001",
    whatsapp: null,
    address: "House 12, Road 4, Uttara",
    zone: "Sector 11",
  },
];
const orders = [
  {
    order_number: "VEL-01934",
    name: "Rahim Ahmed",
    phone: "01711000001",
    address: "House 12, Road 4, Uttara",
    zone: "Sector 11",
    outlet_code: "S11",
    order_status: "Ready",
    due: 850,
    delivery_date: dhakaDate(),
  },
];
const seedDay = dhakaDate();
const base: Appointment = {
  id: null,
  dispatch_job_id: null,
  kind: "pickup",
  contact_name: "Sadia Rahman",
  phone_key: "01811000002",
  area: "Sector 13",
  address: "House 4, Road 3",
  order_number: null,
  assignee_id: null,
  assignee_name: null,
  outlet_code: "S11",
  scheduled_start: null,
  scheduled_end: null,
  status: "scheduled",
  version: 1,
  processing_stage: null,
  source: "phone",
  notes: "",
  blocking_reason: "",
};
const rows: Appointment[] = [
  {
    ...base,
    id: "preview-pickup",
    dispatch_job_id: "job-1",
    contact_name: "Rahim Ahmed",
    customer_id: "customer-1",
    assignee_id: "rider-1",
    assignee_name: "Monir",
    ...dates("09:30", 30),
    promised_date: seedDay,
    promised_window: "morning",
  },
  {
    ...base,
    id: "preview-delivery",
    dispatch_job_id: "job-2",
    kind: "delivery",
    order_number: "VEL-01934",
    contact_name: "Rahim Ahmed",
    assignee_id: "rider-2",
    assignee_name: "Rakib",
    ...dates("11:30", 30),
    order_status: "Ready",
    due: 850,
  },
  {
    ...base,
    id: "preview-processing",
    kind: "processing",
    order_number: "VEL-01935",
    contact_name: "Nusrat Jahan",
    assignee_id: "worker-1",
    assignee_name: "Oli",
    processing_stage: "ironing",
    ...dates("10:00", 90),
    status: "in_progress",
  },
  {
    ...base,
    id: "preview-unassigned",
    dispatch_job_id: "job-3",
    ...dates("13:00", 30),
  },
];
const unscheduled = [
  {
    ...base,
    dispatch_job_id: "job-new",
    contact_name: "Farhana Chowdhury",
    slot_date: seedDay,
    slot: "evening",
    requested: "Evening 4–8 PM",
    source: "website",
  },
];
function dates(time: string, duration: number) {
  const x = exactInterval(seedDay, time, duration)!;
  return { scheduled_start: x.start, scheduled_end: x.end };
}
export function previewBoard(day: string): SchedulerBoard {
  const can_process = process.env.VELTO_ADMIN_PREVIEW_ROLE !== "support";
  return {
    ok: true,
    loaded_at: new Date().toISOString(),
    config: { interval_minutes: 30, starts_at: "09:00", ends_at: "22:00" },
    appointments: rows.filter(
      (a) =>
        (!a.scheduled_start ||
          dhakaDate(new Date(a.scheduled_start)) === day) &&
        (can_process || a.kind !== "processing"),
    ),
    unscheduled,
    people,
    outlets: [
      { code: "S11", name: "Sector 11" },
      { code: "RUAP", name: "Sector 18 · RUAP" },
    ],
    windows: [
      { id: "morning", starts: "09:00", ends: "12:00", active: true },
      { id: "afternoon", starts: "12:00", ends: "16:00", active: true },
      { id: "evening", starts: "16:00", ends: "20:00", active: true },
    ],
    can_process,
  };
}
export function previewSearch(query: string): SearchResult {
  const q = query.toLowerCase();
  return {
    ok: true,
    customers: customers.filter((c) =>
      [c.name, c.phone, c.customer_code].some((s) =>
        s.toLowerCase().includes(q),
      ),
    ),
    orders: orders.filter((o) =>
      [o.order_number, o.phone, o.name].some((s) =>
        s.toLowerCase().includes(q),
      ),
    ),
  };
}
export function previewSave(d: Record<string, unknown>): SchedulerResult {
  const old = rows.find((a) => a.id === d.id);
  if (old && old.version !== d.version)
    return { ok: false, error: "stale_version" };
  const start = String(d.start),
    end = String(d.end),
    person = people.find((p) => p.id === d.assignee_id);
  if (
    rows.some(
      (a) =>
        a.id !== d.id &&
        active(a) &&
        a.assignee_id === d.assignee_id &&
        d.assignee_id &&
        a.scheduled_start &&
        a.scheduled_end &&
        overlaps(start, end, a.scheduled_start, a.scheduled_end),
    )
  )
    return {
      ok: false,
      error: d.kind === "processing" ? "worker_conflict" : "rider_conflict",
    };
  const order = orders.find((o) => o.order_number === d.order_number);
  const a: Appointment = {
    ...base,
    ...old,
    id: String(d.id),
    kind: d.kind as Appointment["kind"],
    dispatch_job_id:
      d.kind === "processing"
        ? null
        : String(d.dispatch_job_id || `job-${d.id}`),
    contact_name: order?.name || String(d.name),
    phone_key: order?.phone || String(d.phone),
    area: String(d.area),
    address: String(d.address),
    assignee_id: person?.id ?? null,
    assignee_name: person?.name ?? null,
    scheduled_start: start,
    scheduled_end: end,
    order_number: String(d.order_number || "") || null,
    order_status: order?.order_status,
    processing_stage: String(d.processing_stage || "") || null,
    notes: String(d.notes || ""),
    blocking_reason: String(d.blocking_reason || ""),
    version: (old?.version ?? 0) + 1,
    outlet_code: String(d.outlet_code),
  };
  if (old) rows.splice(rows.indexOf(old), 1, a);
  else rows.push(a);
  const i = unscheduled.findIndex(
    (u) => u.dispatch_job_id === d.dispatch_job_id,
  );
  if (i >= 0) unscheduled.splice(i, 1);
  return {
    ok: true,
    id: a.id!,
    version: a.version,
    existing_customer: customers.some((c) => c.phone === d.phone),
  };
}
export function previewTransition(
  id: string,
  version: number,
  status: string,
  reason: string,
): SchedulerResult {
  const a = rows.find((x) => x.id === id);
  if (!a) return { ok: false, error: "not_found" };
  if (
    a.kind === "processing" &&
    process.env.VELTO_ADMIN_PREVIEW_ROLE === "support"
  )
    return { ok: false, error: "permission_denied" };
  if (a.version !== version) return { ok: false, error: "stale_version" };
  if (status === "cancelled" && !reason) return { ok: false, error: "reason" };
  a.status = status as Appointment["status"];
  a.version++;
  return { ok: true };
}
