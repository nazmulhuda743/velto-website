import "server-only";

import { isSupabaseConfigured, supabaseFetch } from "../supabase-server";
import type { Loaded } from "./analytics-data";
import type { BoardTask } from "./board-logic";
import { isAdminPreview } from "./preview";

/**
 * Website team task board (docs/technical/sql/website_board.sql). Service role only, from the
 * admin server. Tasks are never deleted, only archived.
 */

export type BoardComment = { id: number; task_id: string; author_name: string; body: string; created_at: string };

const COLUMNS = "id,title,description,status,priority,position,assignee_id,assignee_name,due_date,labels,checklist,created_by_name,created_at,updated_at,completed_at";
const NOT_INSTALLED = "The task board isn't installed in this database yet (docs/technical/sql/website_board.sql).";

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const previewTasks = (): BoardTask[] => {
  const t = (id: number, title: string, status: BoardTask["status"], extra: Partial<BoardTask> = {}): BoardTask => ({
    id: `00000000-0000-4000-8000-0000000001${String(id).padStart(2, "0")}`,
    title,
    description: null,
    status,
    priority: "normal",
    position: id * 1024,
    assignee_id: null,
    assignee_name: null,
    due_date: null,
    labels: [],
    checklist: [],
    created_by_name: "Preview admin",
    created_at: new Date(Date.now() - id * 3_600_000).toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: status === "done" ? new Date().toISOString() : null,
    comments: 0,
    ...extra,
  });
  return [
    t(1, "Photograph the Sector 18 outlet", "todo", { priority: "high", assignee_name: "Preview Designer", due_date: day(2), labels: ["photos"], checklist: [{ text: "Storefront", done: true }, { text: "Counter", done: false }] }),
    t(2, "Eid holiday hours on the announcement bar", "todo", { priority: "urgent", due_date: day(-1), labels: ["website", "eid"] }),
    t(3, "Reply to new Google reviews", "doing", { assignee_name: "Preview Manager", comments: 2 }),
    t(4, "Update curtain page copy", "review", { assignee_name: "Preview Designer", labels: ["copy"] }),
    t(5, "Message this week's second-order list", "done", { assignee_name: "Preview Manager" }),
  ];
};

export async function getBoard(): Promise<Loaded<BoardTask[]>> {
  if (isAdminPreview()) return { state: "ok", data: previewTasks(), preview: true };
  if (!isSupabaseConfigured()) return { state: "not_configured" };
  try {
    const q = new URLSearchParams({ select: `${COLUMNS},website_board_comments(count)`, archived: "eq.false", order: "position.asc", limit: "1000" });
    const res = await supabaseFetch(`/rest/v1/website_board_tasks?${q}`, { cache: "no-store" });
    if (res.status === 404) return { state: "error", message: NOT_INSTALLED };
    if (!res.ok) return { state: "error", message: "The task board could not be read right now." };
    const rows = (await res.json()) as (BoardTask & { website_board_comments?: { count: number }[] })[];
    return {
      state: "ok",
      data: rows.map(({ website_board_comments, ...t }) => ({ ...t, comments: website_board_comments?.[0]?.count ?? 0 })),
    };
  } catch {
    return { state: "error", message: "The task board could not be read right now." };
  }
}

export async function getTask(id: string): Promise<{ task: BoardTask; comments: BoardComment[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (isAdminPreview()) {
    const task = previewTasks().find((t) => t.id === id);
    return task ? { task, comments: task.comments ? [{ id: 1, task_id: id, author_name: "Preview Manager", body: "Started on this.", created_at: new Date().toISOString() }] : [] } : null;
  }
  const [t, c] = await Promise.all([
    supabaseFetch(`/rest/v1/website_board_tasks?${new URLSearchParams({ select: COLUMNS, id: `eq.${id}`, archived: "eq.false" })}`, { cache: "no-store" }),
    supabaseFetch(`/rest/v1/website_board_comments?${new URLSearchParams({ select: "id,task_id,author_name,body,created_at", task_id: `eq.${id}`, order: "created_at.asc" })}`, { cache: "no-store" }),
  ]);
  if (!t.ok) return null;
  const [task] = (await t.json()) as BoardTask[];
  if (!task) return null;
  return { task, comments: c.ok ? ((await c.json()) as BoardComment[]) : [] };
}

/** Open tasks assigned to someone, for the menu badge. */
export async function myOpenTasks(userId: string): Promise<number> {
  if (isAdminPreview()) return 2;
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(userId)) return 0;
  try {
    const q = new URLSearchParams({ select: "id", assignee_id: `eq.${userId}`, archived: "eq.false", status: "neq.done" });
    const res = await supabaseFetch(`/rest/v1/website_board_tasks?${q}`, { cache: "no-store", headers: { Prefer: "count=exact", Range: "0-0" } });
    const total = Number(res.headers.get("content-range")?.split("/")[1]);
    return res.ok && Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

/** Insert or patch a task. Returns the row or an error message. */
export async function writeTask(id: string | null, fields: Record<string, unknown>): Promise<{ ok: true; task: BoardTask } | { ok: false; message: string }> {
  try {
    const res = await supabaseFetch(id ? `/rest/v1/website_board_tasks?id=eq.${id}&archived=eq.false` : "/rest/v1/website_board_tasks", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fields),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, message: NOT_INSTALLED };
    if (!res.ok) return { ok: false, message: "Couldn't save the task. Check the fields and try again." };
    const [task] = (await res.json()) as BoardTask[];
    return task ? { ok: true, task } : { ok: false, message: "That task no longer exists." };
  } catch {
    return { ok: false, message: "The database did not answer. Try again." };
  }
}

export async function addComment(taskId: string, author: { id: string; name: string }, body: string) {
  const res = await supabaseFetch("/rest/v1/website_board_comments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ task_id: taskId, author_id: /^[0-9a-f-]{36}$/i.test(author.id) ? author.id : null, author_name: author.name.slice(0, 120), body }),
    cache: "no-store",
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Cards in one column, by position (for placing a moved card). */
export async function columnPositions(status: string): Promise<{ id: string; position: number }[]> {
  if (isAdminPreview()) return previewTasks().filter((t) => t.status === status).map((t) => ({ id: t.id, position: t.position }));
  const q = new URLSearchParams({ select: "id,position", status: `eq.${status}`, archived: "eq.false", order: "position.asc", limit: "1000" });
  const res = await supabaseFetch(`/rest/v1/website_board_tasks?${q}`, { cache: "no-store" });
  return res.ok ? ((await res.json()) as { id: string; position: number }[]) : [];
}
