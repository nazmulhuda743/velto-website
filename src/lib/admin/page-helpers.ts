import { SERVICE_PAGES } from "@/content/services";
import { one } from "@/components/admin/ui";
import { parseRange } from "./insights";

type Params = Record<string, string | string[] | undefined>;

/** Range + plain string params from a dashboard page's searchParams. */
export function readDashboardParams(params: Params) {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, one(v)?.slice(0, 120)])) as Record<string, string | undefined>;
  const range = parseRange({ range: flat.range, from: flat.from, to: flat.to });
  return { flat, range };
}

const SERVICE_NAMES = new Map<string, string>(SERVICE_PAGES.map((s) => [s.slug, s.name]));
export const serviceName = (slug: string) => SERVICE_NAMES.get(slug) ?? slug;
export const SERVICE_OPTIONS = SERVICE_PAGES.map((s) => ({ value: s.slug, label: s.name }));

export const dayLabel = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" })
    : "Never";

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Hours since an instant, or null when there is none. */
export const hoursSince = (iso: string | null | undefined) => (iso ? (Date.now() - Date.parse(iso)) / 3_600_000 : null);
