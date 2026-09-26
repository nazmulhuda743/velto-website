import "server-only";

import { isSupabaseConfigured, supabaseFetch, supabaseRpc } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import type { Role, Section } from "./permissions";
import { isAdminPreview } from "./preview";
import type { Admin } from "./session";

/**
 * Activity log (docs/technical/sql/website_admin_access.sql): one row per change and sign-in.
 * Append-only: the website can add rows but never edit or delete them.
 */

export type ActivityInput = {
  section: Section | "session";
  /** Short machine name, e.g. "image_replaced". */
  action: string;
  /** What was changed (slot id, page path, review id…), when there is one. */
  target?: string | null;
  /** One human sentence, e.g. "Replaced the photo for Homepage hero". */
  summary: string;
  /** Small before/after facts. Never passwords, tokens or customer phone numbers. */
  detail?: Record<string, unknown>;
};

export type ActivityRow = {
  id: number;
  at: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  section: string;
  action: string;
  target: string | null;
  summary: string;
  detail: Record<string, unknown>;
};

const cut = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);

/** Records an admin action. Never throws: a logging hiccup must not undo the change itself. */
export async function logActivity(admin: Pick<Admin, "id" | "name" | "role">, entry: ActivityInput) {
  if (isAdminPreview() || !isSupabaseConfigured()) return;
  try {
    const res = await supabaseFetch("/rest/v1/website_admin_activity", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_id: /^[0-9a-f-]{36}$/i.test(admin.id) ? admin.id : null,
        actor_name: cut(admin.name || "Unknown", 120),
        actor_role: admin.role,
        section: entry.section,
        action: cut(entry.action, 40),
        target: entry.target ? cut(entry.target, 200) : null,
        summary: cut(entry.summary, 300),
        detail: entry.detail ?? {},
      }),
      cache: "no-store",
    });
    if (!res.ok && res.status !== 404) console.error("admin_activity_log_failed", res.status);
  } catch (error) {
    console.error("admin_activity_log_failed", error instanceof Error ? error.message : "unknown");
  }
}

export type ActivityFilter = { actor?: string; section?: string; from?: string; to?: string; limit?: number };

export async function getActivity(filter: ActivityFilter): Promise<Loaded<ActivityRow[]>> {
  if (isAdminPreview()) {
    const now = Date.now();
    const rows: ActivityRow[] = [
      { id: 3, at: new Date(now - 5 * 60_000).toISOString(), actor_id: null, actor_name: "Preview Designer", actor_role: "designer", section: "images", action: "image_replaced", target: "hero", summary: "Replaced the photo for Homepage hero", detail: { alt: "A courier handing over garments" } },
      { id: 2, at: new Date(now - 95 * 60_000).toISOString(), actor_id: null, actor_name: "Preview admin", actor_role: "owner", section: "access", action: "member_added", target: "designer@example.com", summary: "Gave Preview Designer the Designer role", detail: { role: "designer" } },
      { id: 1, at: new Date(now - 26 * 3_600_000).toISOString(), actor_id: null, actor_name: "Preview admin", actor_role: "owner", section: "session", action: "signed_in", target: null, summary: "Signed in", detail: {} },
    ];
    return { state: "ok", data: rows, preview: true };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  const q = new URLSearchParams({ select: "id,at,actor_id,actor_name,actor_role,section,action,target,summary,detail", order: "at.desc" });
  q.set("limit", String(Math.min(Math.max(filter.limit ?? 200, 1), 1000)));
  if (filter.actor && /^[0-9a-f-]{36}$/i.test(filter.actor)) q.append("actor_id", `eq.${filter.actor}`);
  if (filter.section && /^[a-z]{1,30}$/.test(filter.section)) q.append("section", `eq.${filter.section}`);
  if (filter.from && /^\d{4}-\d{2}-\d{2}$/.test(filter.from)) q.append("at", `gte.${filter.from}T00:00:00+06:00`);
  if (filter.to && /^\d{4}-\d{2}-\d{2}$/.test(filter.to)) q.append("at", `lt.${nextDay(filter.to)}T00:00:00+06:00`);
  try {
    const res = await supabaseFetch(`/rest/v1/website_admin_activity?${q}`, { cache: "no-store" });
    if (res.status === 404) return { state: "error", message: "The activity log isn't installed in this database yet (docs/technical/sql/website_admin_access.sql)." };
    if (!res.ok) return { state: "error", message: "The activity log could not be read right now." };
    return { state: "ok", data: (await res.json()) as ActivityRow[] };
  } catch {
    return { state: "error", message: "The activity log could not be read right now." };
  }
}

const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export type Person = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  origin: "ops_admin" | "website" | "existing";
  createdBy: string | null;
  createdAt: string | null;
  lastSeen: string | null;
};

export async function getPeople(): Promise<Loaded<Person[]>> {
  if (isAdminPreview()) {
    return {
      state: "ok",
      preview: true,
      data: [
        { userId: "00000000-0000-4000-8000-000000000001", name: "Preview admin", email: "owner@example.com", role: "owner", active: true, origin: "ops_admin", createdBy: null, createdAt: null, lastSeen: new Date().toISOString() },
        { userId: "00000000-0000-4000-8000-000000000002", name: "Preview Designer", email: "designer@example.com", role: "designer", active: true, origin: "website", createdBy: "Preview admin", createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), lastSeen: new Date(Date.now() - 300_000).toISOString() },
        { userId: "00000000-0000-4000-8000-000000000003", name: "Preview Manager", email: "manager@example.com", role: "manager", active: false, origin: "existing", createdBy: "Preview admin", createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(), lastSeen: null },
      ],
    };
  }
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    return { state: "ok", data: await supabaseRpc<Person[]>("website_admin_people", {}) };
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return {
      state: "error",
      message: /HTTP 404/.test(m) ? "The Access tables aren't installed in this database yet (docs/technical/sql/website_admin_access.sql)." : "The access list could not be read right now.",
    };
  }
}
