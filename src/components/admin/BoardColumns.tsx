"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type DragEvent } from "react";

/**
 * Kanban columns with drag and drop. Plain HTML5 drag events on desktop; on touch screens and for
 * keyboard users every card also opens with a "Move to" control in its detail panel. The server
 * action checks the role and records the move; the page then refreshes from the database.
 */

export type CardView = {
  id: string;
  title: string;
  status: string;
  priority: string;
  priorityLabel: string;
  assignee: string | null;
  initials: string;
  due: string | null;
  dueState: "overdue" | "today" | "soon" | "later" | null;
  labels: string[];
  checklist: { done: number; total: number };
  comments: number;
  href: string;
};

export type LinkedCard = { id: string; title: string; sub: string; href: string };

type Column = { key: string; label: string };

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-error-soft text-error",
  high: "bg-warning-soft text-warning",
  normal: "bg-soft text-secondary",
  low: "bg-soft text-muted",
};
const DUE_TONE: Record<string, string> = { overdue: "text-error font-semibold", today: "text-warning font-semibold", soon: "text-navy", later: "text-secondary" };

export function BoardColumns({
  columns,
  cards,
  linked,
  move,
}: {
  columns: Column[];
  cards: CardView[];
  /** Price-change requests shown in Review (not draggable; they open their own page). */
  linked: LinkedCard[];
  move: (id: string, status: string, beforeId: string | null) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [view, applyMove] = useOptimistic(cards, (state, m: { id: string; status: string; beforeId: string | null }) => {
    const card = state.find((c) => c.id === m.id);
    if (!card) return state;
    const rest = state.filter((c) => c.id !== m.id);
    const moved = { ...card, status: m.status };
    const at = m.beforeId ? rest.findIndex((c) => c.id === m.beforeId) : -1;
    if (at === -1) return [...rest, moved];
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  });

  const drop = (e: DragEvent, status: string, beforeId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    setOver(null);
    setDragId(null);
    if (!id || id === beforeId) return;
    setError("");
    start(async () => {
      applyMove({ id, status, beforeId });
      const r = await move(id, status, beforeId);
      if (!r.ok) setError(r.message ?? "Couldn't move the task.");
      router.refresh();
    });
  };

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 rounded-md border border-error/30 bg-error-soft px-4 py-2 t-small font-medium text-error">
          {error}
        </p>
      ) : null}
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0 xl:grid xl:grid-cols-4 xl:overflow-visible" aria-busy={pending}>
        {columns.map((col) => {
          const list = view.filter((c) => c.status === col.key);
          const extra = col.key === "review" ? linked : [];
          return (
            <section
              key={col.key}
              aria-label={col.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => drop(e, col.key, null)}
              className={`flex min-w-0 snap-start flex-col rounded-lg border p-2.5 transition-colors max-xl:w-[82vw] max-xl:max-w-[320px] max-xl:shrink-0 sm:max-xl:w-[300px] ${
                over === col.key ? "border-blue bg-[#e8f3fb]" : "border-line bg-soft"
              }`}
            >
              <h2 className="flex items-center justify-between px-1.5 pb-2 pt-1 t-small font-semibold text-navy">
                {col.label}
                <span className="rounded-full bg-white px-2 text-[12px] leading-5 text-secondary tabular-nums">{list.length + extra.length}</span>
              </h2>
              <ol className="flex min-h-16 flex-col gap-2">
                {extra.map((l) => (
                  <li key={l.id}>
                    <Link href={l.href} className="block rounded-md border border-dashed border-warning/30 bg-warning-soft p-3 hover:border-warning">
                      <span className="t-caption font-semibold uppercase tracking-[0.04em] text-warning">Needs approval</span>
                      <span className="mt-0.5 block t-small font-semibold text-navy">{l.title}</span>
                      <span className="block t-caption text-secondary">{l.sub}</span>
                    </Link>
                  </li>
                ))}
                {list.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(c.id);
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, col.key, c.id)}
                    className={`group rounded-md border border-line bg-white shadow-[0_1px_2px_rgba(0,43,78,0.06)] ${dragId === c.id ? "opacity-40" : ""}`}
                  >
                    <Link href={c.href} className="block cursor-grab p-3 active:cursor-grabbing" draggable={false}>
                      {c.labels.length ? (
                        <span className="mb-1.5 flex flex-wrap gap-1">
                          {c.labels.map((l) => (
                            <span key={l} className="rounded-sm bg-[#e8f3fb] px-1.5 text-[11px] font-semibold leading-5 text-blue">
                              {l}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span className={`block t-small font-semibold text-navy ${c.status === "done" ? "line-through decoration-secondary/50" : ""}`}>{c.title}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 t-caption text-secondary">
                        {c.priority !== "normal" ? <span className={`rounded-sm px-1.5 font-semibold leading-5 ${PRIORITY_TONE[c.priority]}`}>{c.priorityLabel}</span> : null}
                        {c.due ? <span className={DUE_TONE[c.dueState ?? "later"]}>{c.dueState === "overdue" ? "Overdue · " : ""}{c.due}</span> : null}
                        {c.checklist.total ? (
                          <span className={c.checklist.done === c.checklist.total ? "font-semibold text-success" : ""}>
                            {c.checklist.done}/{c.checklist.total} done
                          </span>
                        ) : null}
                        {c.comments ? <span>{c.comments} comment{c.comments === 1 ? "" : "s"}</span> : null}
                        <span className="ml-auto inline-flex size-6 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white" title={c.assignee ?? "Unassigned"}>
                          {c.assignee ? c.initials : "–"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
