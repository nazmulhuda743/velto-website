import { formatAmount } from "@/lib/format-price";

/** Ops order status → customer-facing stage. Presentation only; Ops values never change. */
export const ORDER_STAGES = [
  { status: "New", title: "Booked", copy: "Your order is booked." },
  { status: "Picked", title: "Collected", copy: "We've collected it from your address." },
  { status: "In Velto Facility", title: "Being cleaned", copy: "Checked in, tagged and being cleaned." },
  { status: "Ready", title: "Ready", copy: "Cleaned, checked and packed for return." },
  { status: "Delivered", title: "Delivered", copy: "Returned to you." },
] as const;

export const stageIndex = (status: string) => ORDER_STAGES.findIndex((s) => s.status === status);

export const statusTitle = (status: string) =>
  status === "Cancelled" ? "Cancelled" : (ORDER_STAGES[stageIndex(status)]?.title ?? "In progress");

/** "Thu 24 Sep" from an ISO date or timestamp (dates are Dhaka calendar days). */
export const formatDay = (value: string | null | undefined, withYear = false) =>
  value
    ? new Date(value.length === 10 ? `${value}T00:00:00+06:00` : value).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "Asia/Dhaka",
      })
    : null;

export const formatTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }) : null;

export const taka = (n: number | null | undefined) => (n === null || n === undefined ? null : formatAmount(Math.round(n * 100)));

export const serviceLabel = (s: string) => s.replace("Wash + Iron", "Wash & Iron");
