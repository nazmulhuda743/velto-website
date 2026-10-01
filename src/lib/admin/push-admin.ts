import "server-only";

import { isSupabaseConfigured, supabaseRpc } from "../supabase-server";
import { isAdminPreview } from "./preview";

/**
 * Phone notifications for staff (Admin → Customer accounts): which phones have them on and whether
 * the last one reached the push service. docs/technical/sql/website_push_admin.sql.
 */
export type PushDevice = {
  phone: string | null;
  lang: string;
  device: string | null;
  active: boolean;
  orderUpdates: boolean;
  reminders: boolean;
  failures: number;
  createdAt: string;
  lastSentAt: string | null;
};

const PREVIEW: PushDevice[] = [
  { phone: "01711000001", lang: "bn", device: "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36", active: true, orderUpdates: true, reminders: true, failures: 0, createdAt: "2026-09-29T08:10:00Z", lastSentAt: "2026-10-01T06:20:00Z" },
  { phone: "01811000002", lang: "en", device: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", active: true, orderUpdates: true, reminders: false, failures: 2, createdAt: "2026-09-30T12:00:00Z", lastSentAt: null },
  { phone: "01911000003", lang: "bn", device: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36", active: false, orderUpdates: true, reminders: true, failures: 5, createdAt: "2026-09-20T09:00:00Z", lastSentAt: "2026-09-25T09:00:00Z" },
];

export type PushDevices = { state: "ok"; devices: PushDevice[] } | { state: "missing" } | { state: "error" };

export async function getPushDevices(): Promise<PushDevices> {
  if (isAdminPreview()) return { state: "ok", devices: PREVIEW };
  if (!isSupabaseConfigured()) return { state: "missing" };
  try {
    return { state: "ok", devices: await supabaseRpc<PushDevice[]>("website_push_admin_list", { p_limit: 100 }) };
  } catch (e) {
    return String(e).includes("404") ? { state: "missing" } : { state: "error" };
  }
}

/** "Chrome · Android" from a user agent, for a staff list. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : "Other";
  const browser = /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} · ${os}`;
}
