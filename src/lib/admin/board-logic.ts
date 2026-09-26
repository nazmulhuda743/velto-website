/**
 * Task board rules shared by the page, the drag-and-drop client and the server actions.
 * Pure (no imports), so it is unit-tested.
 */

export const STATUSES = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "In progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const;
export type Status = (typeof STATUSES)[number]["key"];
export const isStatus = (v: unknown): v is Status => STATUSES.some((s) => s.key === v);

export const PRIORITIES = [
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["key"];
export const isPriority = (v: unknown): v is Priority => PRIORITIES.some((p) => p.key === v);

export type ChecklistItem = { text: string; done: boolean };

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  position: number;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  labels: string[];
  checklist: ChecklistItem[];
  created_by_name: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  comments?: number;
};

/**
 * Position for a card dropped between two neighbours (either may be missing). Fractional, so a
 * move writes one row; far-apart gaps keep plenty of room for later moves.
 */
export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  const hasBefore = typeof before === "number" && Number.isFinite(before);
  const hasAfter = typeof after === "number" && Number.isFinite(after);
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + 1024;
  if (hasAfter) return after - 1024;
  return 1024;
}

/** "Website, urgent ,  eid" → ["website", "urgent", "eid"]: trimmed, lower-case, unique, max 8 × 24 chars. */
export function parseLabels(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const label = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24);
    if (label && !out.includes(label)) out.push(label);
    if (out.length === 8) break;
  }
  return out;
}

export function checklistProgress(list: ChecklistItem[]) {
  const done = list.filter((i) => i.done).length;
  return { done, total: list.length };
}

/** Due-date state on a Dhaka calendar day (YYYY-MM-DD strings compare in order). */
export function dueState(due: string | null, today: string, status: Status): "overdue" | "today" | "soon" | "later" | null {
  if (!due || status === "done") return null;
  if (due < today) return "overdue";
  if (due === today) return "today";
  const days = (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 2 ? "soon" : "later";
}

/** Cards in a column: by position, then oldest first. */
export const sortTasks = (tasks: BoardTask[]) => [...tasks].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

/** Initials for an assignee avatar ("Nazmul Huda" → "NH"). */
export const initials = (name: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
