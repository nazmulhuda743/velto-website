import "server-only";
import { supabaseRpc } from "../supabase-server";
import type {
  Appointment,
  SchedulerBoard,
  SchedulerResult,
  SearchResult,
} from "../scheduler/logic";
import { isAdminPreview } from "./preview";
import {
  previewBoard,
  previewSave,
  previewSearch,
  previewTransition,
} from "./scheduler-preview";
export async function schedulerBoard(
  actor: string,
  day: string,
): Promise<SchedulerBoard | { ok: false; error: string }> {
  if (isAdminPreview()) return previewBoard(day);
  try {
    const data = await supabaseRpc<SchedulerBoard>("ops_scheduler_board", {
      p_actor: actor,
      p_day: day,
    });
    if (!data.ok) return data;
    data.unscheduled = (data.unscheduled ?? []).map(
      (a) =>
        ({
          ...a,
          id: null,
          scheduled_start: null,
          scheduled_end: null,
          status: "scheduled",
          version: 0,
          processing_stage: null,
          notes: "",
          blocking_reason: "",
        }) as Appointment,
    );
    return data;
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
export async function schedulerSearch(
  actor: string,
  query: string,
): Promise<SearchResult> {
  if (isAdminPreview()) return previewSearch(query);
  try {
    return await supabaseRpc<SearchResult>("ops_scheduler_search", {
      p_actor: actor,
      p_query: query,
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
export async function schedulerSave(
  actor: string,
  data: Record<string, unknown>,
): Promise<SchedulerResult> {
  if (isAdminPreview()) return previewSave(data);
  try {
    return await supabaseRpc<SchedulerResult>("ops_scheduler_save", {
      p_actor: actor,
      p_data: data,
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
export async function schedulerTransition(
  actor: string,
  id: string,
  version: number,
  status: string,
  reason: string,
): Promise<SchedulerResult> {
  if (isAdminPreview()) return previewTransition(id, version, status, reason);
  try {
    return await supabaseRpc<SchedulerResult>("ops_scheduler_transition", {
      p_actor: actor,
      p_id: id,
      p_version: version,
      p_status: status,
      p_reason: reason,
    });
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
