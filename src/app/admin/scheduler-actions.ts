"use server";
import { requireSection } from "@/lib/admin/session";
import {
  schedulerBoard,
  schedulerSave,
  schedulerSearch,
  schedulerTransition,
} from "@/lib/admin/scheduler";
import { validDay, type SchedulerResult } from "@/lib/scheduler/logic";
export async function loadScheduler(day: string) {
  const admin = await requireSection("dispatch");
  if (!validDay(day)) return { ok: false as const, error: "invalid" };
  return schedulerBoard(admin.id, day);
}
export async function searchScheduler(query: string) {
  const admin = await requireSection("dispatch");
  return schedulerSearch(admin.id, query.slice(0, 80));
}
export async function saveAppointment(
  data: Record<string, unknown>,
): Promise<SchedulerResult> {
  const admin = await requireSection("dispatch");
  if (
    (data.kind === "processing" || data.override_reason) &&
    !["owner", "manager"].includes(admin.role)
  )
    return { ok: false, error: "permission_denied" };
  return schedulerSave(admin.id, data);
}
export async function transitionAppointment(
  id: string,
  version: number,
  status: string,
  reason: string,
): Promise<SchedulerResult> {
  const admin = await requireSection("dispatch");
  return schedulerTransition(
    admin.id,
    id,
    version,
    status,
    reason.slice(0, 300),
  );
}
export async function saveSchedulerSettings(
  interval: number,
  starts: string,
  ends: string,
): Promise<SchedulerResult> {
  const admin = await requireSection("riders");
  if (!["owner", "manager"].includes(admin.role))
    return { ok: false, error: "permission_denied" };
  const { supabaseRpc } = await import("@/lib/supabase-server");
  const { isAdminPreview } = await import("@/lib/admin/preview");
  if (isAdminPreview()) return { ok: false, error: "unavailable" };
  try {
    return await supabaseRpc<SchedulerResult>("ops_scheduler_settings", {
      p_actor: admin.id,
      p_interval: interval,
      p_start: starts,
      p_end: ends,
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
