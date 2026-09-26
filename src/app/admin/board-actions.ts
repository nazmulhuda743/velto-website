"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPeople, logActivity } from "@/lib/admin/activity";
import { addComment, columnPositions, getTask, writeTask } from "@/lib/admin/board";
import { isPriority, isStatus, parseLabels, positionBetween, STATUSES, type ChecklistItem, type Status } from "@/lib/admin/board-logic";
import { canArchiveTasks } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";

/**
 * Task board. Everyone with the Board can add, edit, move and comment; Owners and Managers can
 * archive. Every change is recorded in Activity.
 */

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f-]{36}$/i;
const statusLabel = (s: string) => STATUSES.find((x) => x.key === s)?.label ?? s;

function backTo(form: FormData, extra: Record<string, string> = {}): never {
  const keep = new URLSearchParams(text(form, "keep", 300));
  for (const [k, v] of Object.entries(extra)) keep.set(k, v);
  redirect(`/admin/board?${keep}`);
}

/** The assignee must be someone on the Access page (name stored for display). */
async function assignee(id: string): Promise<{ assignee_id: string | null; assignee_name: string | null } | "invalid"> {
  if (!id) return { assignee_id: null, assignee_name: null };
  const people = await getPeople();
  const p = people.state === "ok" ? people.data.find((x) => x.userId === id && x.active) : undefined;
  return p ? { assignee_id: p.userId, assignee_name: p.name } : "invalid";
}

async function endOfColumn(status: Status) {
  const col = await columnPositions(status);
  return positionBetween(col.at(-1)?.position ?? null, null);
}

export async function createTaskAction(form: FormData) {
  const admin = await requireSection("board");
  const title = text(form, "title", 160);
  const status = text(form, "status", 10) || "todo";
  const priority = text(form, "priority", 10) || "normal";
  const due = text(form, "due_date", 10);
  if (!title) backTo(form, { error: "Give the task a title." });
  if (!isStatus(status) || !isPriority(priority)) backTo(form, { error: "Unknown status or priority." });
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) backTo(form, { error: "Use a valid due date." });
  const who = await assignee(text(form, "assignee", 40));
  if (who === "invalid") backTo(form, { error: "Choose someone from the list." });

  const saved = await writeTask(null, {
    title,
    description: text(form, "description", 5000) || null,
    status,
    priority,
    due_date: due || null,
    labels: parseLabels(text(form, "labels", 300)),
    position: await endOfColumn(status as Status),
    ...(who as object),
    created_by_id: UUID.test(admin.id) ? admin.id : null,
    created_by_name: admin.name,
  });
  if (!saved.ok) backTo(form, { error: saved.message });
  const task = (saved as { ok: true; task: { id: string } }).task;
  await logActivity(admin, {
    section: "board",
    action: "task_created",
    target: task.id,
    summary: `Added the task “${title}” to ${statusLabel(status)}${(who as { assignee_name: string | null }).assignee_name ? ` for ${(who as { assignee_name: string }).assignee_name}` : ""}`,
  });
  revalidatePath("/admin", "layout");
  backTo(form, { saved: "created" });
}

export async function updateTaskAction(form: FormData) {
  const admin = await requireSection("board");
  const id = text(form, "id", 40);
  const current = UUID.test(id) ? await getTask(id) : null;
  if (!current) backTo(form, { error: "That task no longer exists." });
  const before = current!.task;
  const title = text(form, "title", 160);
  const status = text(form, "status", 10);
  const priority = text(form, "priority", 10);
  const due = text(form, "due_date", 10);
  if (!title) backTo(form, { task: id, error: "Give the task a title." });
  if (!isStatus(status) || !isPriority(priority)) backTo(form, { task: id, error: "Unknown status or priority." });
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) backTo(form, { task: id, error: "Use a valid due date." });
  const who = await assignee(text(form, "assignee", 40));
  if (who === "invalid") backTo(form, { task: id, error: "Choose someone from the list." });

  const fields = {
    title,
    description: text(form, "description", 5000) || null,
    priority,
    due_date: due || null,
    labels: parseLabels(text(form, "labels", 300)),
    ...(who as object),
    ...(status !== before.status ? { status, position: await endOfColumn(status as Status) } : {}),
  };
  const saved = await writeTask(id, fields);
  if (!saved.ok) backTo(form, { task: id, error: saved.message });

  const changed = [
    title !== before.title && "title",
    (fields.description ?? null) !== (before.description ?? null) && "description",
    priority !== before.priority && `priority → ${priority}`,
    (due || null) !== before.due_date && `due → ${due || "none"}`,
    (who as { assignee_id: string | null }).assignee_id !== before.assignee_id && `assigned → ${(who as { assignee_name: string | null }).assignee_name ?? "nobody"}`,
    status !== before.status && `moved → ${statusLabel(status)}`,
    fields.labels.join() !== before.labels.join() && "labels",
  ].filter(Boolean) as string[];
  if (changed.length) {
    await logActivity(admin, { section: "board", action: "task_updated", target: id, summary: `Updated “${title}”: ${changed.join(", ")}` });
  }
  revalidatePath("/admin", "layout");
  backTo(form, { task: id, saved: "updated" });
}

/** Drag and drop (or "Move to"): put a card in a column, before another card or at the end. */
export async function moveTaskAction(id: string, status: string, beforeId: string | null): Promise<{ ok: boolean; message?: string }> {
  const admin = await requireSection("board");
  if (!UUID.test(id) || !isStatus(status) || (beforeId !== null && !UUID.test(beforeId))) return { ok: false, message: "Unknown move." };
  const current = await getTask(id);
  if (!current) return { ok: false, message: "That task no longer exists." };
  const col = (await columnPositions(status)).filter((c) => c.id !== id);
  const at = beforeId ? col.findIndex((c) => c.id === beforeId) : -1;
  const position = at === -1 ? positionBetween(col.at(-1)?.position ?? null, null) : positionBetween(col[at - 1]?.position ?? null, col[at].position);
  const saved = await writeTask(id, { status, position });
  if (!saved.ok) return { ok: false, message: saved.message };
  if (status !== current.task.status) {
    await logActivity(admin, { section: "board", action: "task_moved", target: id, summary: `Moved “${current.task.title}” from ${statusLabel(current.task.status)} to ${statusLabel(status)}` });
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function checklistAction(form: FormData) {
  const admin = await requireSection("board");
  const id = text(form, "id", 40);
  const op = text(form, "op", 10);
  const current = UUID.test(id) ? await getTask(id) : null;
  if (!current) backTo(form, { error: "That task no longer exists." });
  const list: ChecklistItem[] = [...current!.task.checklist];
  const index = Number(text(form, "index", 3));
  if (op === "add") {
    const item = text(form, "text", 200);
    if (!item) backTo(form, { task: id, error: "Write the checklist item first." });
    if (list.length >= 30) backTo(form, { task: id, error: "A task can have up to 30 checklist items." });
    list.push({ text: item, done: false });
  } else if ((op === "toggle" || op === "remove") && Number.isInteger(index) && list[index]) {
    if (op === "toggle") list[index] = { ...list[index], done: !list[index].done };
    else list.splice(index, 1);
  } else {
    backTo(form, { task: id });
  }
  const saved = await writeTask(id, { checklist: list });
  if (!saved.ok) backTo(form, { task: id, error: saved.message });
  if (op === "toggle" && list[index]?.done) {
    await logActivity(admin, { section: "board", action: "checklist_done", target: id, summary: `Ticked “${list[index].text}” on “${current!.task.title}”` });
  }
  backTo(form, { task: id });
}

export async function commentAction(form: FormData) {
  const admin = await requireSection("board");
  const id = text(form, "id", 40);
  const body = text(form, "body", 2000);
  const current = UUID.test(id) ? await getTask(id) : null;
  if (!current) backTo(form, { error: "That task no longer exists." });
  if (!body) backTo(form, { task: id, error: "Write a comment first." });
  if (!(await addComment(id, admin, body))) backTo(form, { task: id, error: "Couldn't post the comment." });
  await logActivity(admin, { section: "board", action: "task_commented", target: id, summary: `Commented on “${current!.task.title}”`, detail: { comment: body.slice(0, 300) } });
  backTo(form, { task: id });
}

export async function archiveTaskAction(form: FormData) {
  const admin = await requireSection("board");
  const id = text(form, "id", 40);
  if (!canArchiveTasks(admin.role)) backTo(form, { task: id, error: "Only Owners and Managers can archive tasks." });
  const current = UUID.test(id) ? await getTask(id) : null;
  if (!current) backTo(form, { error: "That task no longer exists." });
  const saved = await writeTask(id, { archived: true });
  if (!saved.ok) backTo(form, { task: id, error: saved.message });
  await logActivity(admin, { section: "board", action: "task_archived", target: id, summary: `Archived “${current!.task.title}”` });
  revalidatePath("/admin", "layout");
  backTo(form, { saved: "archived" });
}
