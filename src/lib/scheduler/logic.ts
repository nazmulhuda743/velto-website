export type AppointmentKind = "pickup" | "delivery" | "processing";
export type AppointmentStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";
export type Appointment = {
  id: string | null;
  dispatch_job_id: string | null;
  kind: AppointmentKind;
  contact_name: string;
  phone_key: string | null;
  whatsapp?: string | null;
  area: string | null;
  address: string | null;
  customer_id?: string | null;
  order_number: string | null;
  order_status?: string | null;
  due?: number | null;
  delivery_date?: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  outlet_code: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: AppointmentStatus;
  version: number;
  processing_stage: string | null;
  source: string;
  service?: string | null;
  notes: string;
  blocking_reason: string;
  promised_date?: string | null;
  promised_window?: string | null;
  slot_date?: string | null;
  slot?: string | null;
  requested?: string | null;
};
export type Person = {
  id: string;
  name: string;
  role: string;
  can_ride: boolean;
  off: boolean;
};
export type SchedulerBoard = {
  ok: true;
  loaded_at: string;
  config: { interval_minutes: number; starts_at: string; ends_at: string };
  appointments: Appointment[];
  unscheduled: Appointment[];
  people: Person[];
  outlets: { code: string; name: string }[];
  windows: { id: string; starts: string; ends: string; active: boolean }[];
  can_process: boolean;
};
export type SchedulerResult =
  | {
      ok: true;
      id?: string;
      version?: number;
      existing_customer?: boolean;
      repeat?: boolean;
    }
  | { ok: false; error: string };
export type SearchCustomer = {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  zone: string | null;
};
export type SearchOrder = {
  order_number: string;
  name: string;
  phone: string;
  address: string | null;
  zone: string | null;
  outlet_code: string;
  order_status: string;
  due: number;
  delivery_date: string | null;
};
export type SearchResult =
  | { ok: true; customers: SearchCustomer[]; orders: SearchOrder[] }
  | { ok: false; error: string };
export const PROCESSING_STAGES = [
  ["intake", "Intake / checking"],
  ["washing", "Washing"],
  ["dry_cleaning", "Dry cleaning"],
  ["ironing", "Ironing / finishing"],
  ["qc", "Quality check"],
  ["packing", "Packing"],
] as const;
export const SCHEDULER_ERRORS: Record<string, string> = {
  rider_conflict:
    "This person was just booked for overlapping work. Choose another time or rider.",
  worker_conflict:
    "This worker already has overlapping work. Choose another time or worker.",
  stale_version:
    "Another manager changed this appointment. Close and reopen it to use the latest details.",
  outside_customer_window:
    "This time is outside the customer’s promised window. Choose a time inside it, or confirm the change with a reason.",
  slot_full:
    "This area’s time window is full. Choose another window, or an owner or manager can override with a reason.",
  slot_closed: "This time window is closed. Choose an open window.",
  slot_past: "That time has passed. Choose a future time.",
  invalid_time:
    "Choose a time on the schedule grid, within working hours, on the same day.",
  order_not_ready:
    "The order is not ready for delivery. You can plan a future day, but it must be ready before starting or completing delivery.",
  invalid_order: "Choose a real order that is not cancelled or delivered.",
  customer:
    "Enter the customer’s name, valid mobile, sector and pickup address.",
  permission_denied: "Your role does not allow this action.",
  assignee_unavailable:
    "This person is inactive, off, or not available for this work.",
  needs_assignment:
    "Assign a person before starting or completing the appointment.",
  reason: "Enter a reason for cancelling.",
  closed: "This appointment has already moved on. Refresh the board.",
  not_found: "This appointment no longer exists.",
  outlet: "Choose an active outlet.",
  invalid: "Check the appointment details and try again.",
  retry: "Another update is in progress. Try again.",
  unavailable:
    "Could not reach Velto Ops. Your form is still here. Retry without creating a second appointment.",
};
export const schedulerError = (code: string) =>
  SCHEDULER_ERRORS[code] ?? SCHEDULER_ERRORS.unavailable;
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export function dhakaDate(now = new Date()) {
  return new Date(now.getTime() + 21600000).toISOString().slice(0, 10);
}
export function shiftDay(day: string, amount: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function localTime(iso: string | null) {
  return iso
    ? new Date(Date.parse(iso) + 21600000).toISOString().slice(11, 16)
    : "";
}
export function exactInterval(day: string, time: string, duration: number) {
  if (
    !validDay(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !Number.isInteger(duration) ||
    duration < 15 ||
    duration > 720
  )
    return null;
  const start = new Date(`${day}T${time}:00+06:00`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + duration * 60000).toISOString(),
  };
}
export function timeGrid(start: string, end: string, interval: number) {
  const minute = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  if (![15, 30, 60].includes(interval)) return [];
  const out: string[] = [];
  for (let m = minute(start); m < minute(end); m += interval)
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  return out;
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return Date.parse(a) < Date.parse(d) && Date.parse(c) < Date.parse(b);
}
export function active(a: Appointment) {
  return a.status !== "completed" && a.status !== "cancelled";
}
export function appointmentLabel(a: Appointment) {
  if (a.status === "completed") return "Completed";
  if (a.status === "cancelled") return "Cancelled";
  if (a.blocking_reason) return "Blocked";
  if (a.status === "in_progress") return "In progress";
  if (!a.scheduled_start) return "Needs scheduling";
  if (!a.assignee_id) return "Unassigned";
  if (
    a.kind === "delivery" &&
    !["Ready", "Out for Delivery"].includes(a.order_status ?? "")
  )
    return "Planned · not ready";
  return "Scheduled";
}
