import Link from "next/link";
import { BoardColumns, type CardView, type LinkedCard } from "@/components/admin/BoardColumns";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { getPeople } from "@/lib/admin/activity";
import { getBoard, getTask } from "@/lib/admin/board";
import { checklistProgress, dueState, initials, PRIORITIES, sortTasks, STATUSES, type BoardTask } from "@/lib/admin/board-logic";
import { can, canArchiveTasks, canProposePrices } from "@/lib/admin/permissions";
import { getPriceChanges } from "@/lib/admin/price-changes";
import { requestDate } from "@/lib/admin/request-details";
import { requireSection } from "@/lib/admin/session";
import { archiveTaskAction, checklistAction, commentAction, createTaskAction, moveTaskAction, updateTaskAction } from "../../board-actions";

const SAVED: Record<string, string> = { created: "Task added.", updated: "Task saved.", archived: "Task archived." };
const dhakaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const shortDay = (d: string) => new Date(`${d}T00:00:00+06:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.key, p.label])) as Record<string, string>;

function TaskFields({ task, people }: { task?: BoardTask; people: { userId: string; name: string }[] }) {
  return (
    <>
      <label className="block t-small font-semibold text-navy md:col-span-2">
        Title
        <input name="title" required maxLength={160} defaultValue={task?.title} className="admin-input mt-1" />
      </label>
      <label className="block t-small font-semibold text-navy md:col-span-2">
        Description <span className="font-normal text-secondary">(optional)</span>
        <textarea name="description" maxLength={5000} rows={task?.description ? 5 : 3} defaultValue={task?.description ?? ""} className="admin-input mt-1" />
      </label>
      <label className="block t-small font-semibold text-navy">
        Assigned to
        <select name="assignee" defaultValue={task?.assignee_id ?? ""} className="admin-input mt-1">
          <option value="">Nobody yet</option>
          {people.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-small font-semibold text-navy">
        Due date
        <input type="date" name="due_date" defaultValue={task?.due_date ?? ""} className="admin-input mt-1" />
      </label>
      <label className="block t-small font-semibold text-navy">
        Status
        <select name="status" defaultValue={task?.status ?? "todo"} className="admin-input mt-1">
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-small font-semibold text-navy">
        Priority
        <select name="priority" defaultValue={task?.priority ?? "normal"} className="admin-input mt-1">
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-small font-semibold text-navy md:col-span-2">
        Labels <span className="font-normal text-secondary">(comma separated, e.g. website, photos, eid)</span>
        <input name="labels" maxLength={300} defaultValue={task?.labels.join(", ") ?? ""} className="admin-input mt-1" />
      </label>
    </>
  );
}

export default async function BoardPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("board");
  const params = await searchParams;
  const mine = one(params.mine) === "1";
  const label = (one(params.label) ?? "").toLowerCase().slice(0, 24);
  const adding = one(params.new) === "1";
  const taskId = one(params.task);
  const keep = new URLSearchParams({ ...(mine ? { mine: "1" } : {}), ...(label ? { label } : {}) });
  const href = (extra: Record<string, string>) => `/admin/board?${new URLSearchParams({ ...Object.fromEntries(keep), ...extra })}`;

  const [board, people, detail, pendingPrices] = await Promise.all([
    getBoard(),
    getPeople(),
    taskId ? getTask(taskId) : Promise.resolve(null),
    can(admin.role, "approvals") || canProposePrices(admin.role) ? getPriceChanges("pending", 100) : Promise.resolve(null),
  ]);
  const team = people.state === "ok" ? people.data.filter((p) => p.active).map((p) => ({ userId: p.userId, name: p.name })) : [];
  const today = dhakaToday();
  const all = board.state === "ok" ? sortTasks(board.data) : [];
  const allLabels = [...new Set(all.flatMap((t) => t.labels))].sort();
  const shown = all.filter((t) => (!mine || t.assignee_id === admin.id) && (!label || t.labels.includes(label)));
  const cards: CardView[] = shown.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    priorityLabel: PRIORITY_LABEL[t.priority],
    assignee: t.assignee_name,
    initials: initials(t.assignee_name),
    due: t.due_date ? shortDay(t.due_date) : null,
    dueState: dueState(t.due_date, today, t.status),
    labels: t.labels,
    checklist: checklistProgress(t.checklist),
    comments: t.comments ?? 0,
    href: href({ task: t.id }),
  }));
  // Price-change requests appear in Review: Owners see all (to approve), Managers their own.
  const linked: LinkedCard[] =
    pendingPrices?.state === "ok" && !mine && !label
      ? pendingPrices.data
          .filter((c) => can(admin.role, "approvals") || c.requested_by_id === admin.id)
          .map((c) => ({
            id: c.id,
            title: `Price: ${c.kind} ${c.proposed.item_name || c.before?.item_name || "item"}`,
            sub: `${c.requested_by_name} · ${requestDate(c.requested_at)}`,
            href: can(admin.role, "approvals") ? `/admin/approvals#c-${c.id}` : "/admin/prices",
          }))
      : [];
  const openCount = all.filter((t) => t.assignee_id === admin.id && t.status !== "done").length;
  const t = detail?.task;

  return (
    <>
      <AdminHeader
        title="Task board"
        intro="The website team's to-do list. Drag cards between columns, or open a card to edit, assign, tick off its checklist and comment. Price changes waiting for approval appear in Review."
        actions={
          <Link href={href({ new: "1" })} className="admin-btn">
            + New task
          </Link>
        }
      />
      {one(params.error) && !taskId ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {one(params.error)}
        </p>
      ) : null}
      {one(params.saved) && SAVED[one(params.saved)!] && !taskId ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[one(params.saved)!]}
        </p>
      ) : null}
      {board.state === "ok" && board.preview ? <DataNotice state="preview" /> : null}
      {board.state === "error" ? <DataNotice state="error" message={board.message} /> : null}
      {board.state === "not_configured" ? <DataNotice state="not_configured" /> : null}

      <nav aria-label="Filters" className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/board?${new URLSearchParams(label ? { label } : {})}`}
          aria-current={!mine ? "true" : undefined}
          className={`rounded-md border px-3 py-1.5 t-small font-semibold ${!mine ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
        >
          Everyone
        </Link>
        <Link
          href={`/admin/board?${new URLSearchParams({ mine: "1", ...(label ? { label } : {}) })}`}
          aria-current={mine ? "true" : undefined}
          className={`rounded-md border px-3 py-1.5 t-small font-semibold ${mine ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
        >
          My tasks {openCount ? <span className="ml-1 rounded-full bg-cyan px-1.5 text-[11px] text-navy">{openCount}</span> : null}
        </Link>
        {allLabels.length ? <span className="ml-2 t-caption text-secondary">Labels:</span> : null}
        {allLabels.map((l) => (
          <Link
            key={l}
            href={`/admin/board?${new URLSearchParams({ ...(mine ? { mine: "1" } : {}), ...(label === l ? {} : { label: l }) })}`}
            aria-current={label === l ? "true" : undefined}
            className={`rounded-sm px-2 py-0.5 t-caption font-semibold ${label === l ? "bg-blue text-white" : "bg-[#e8f3fb] text-blue hover:bg-blue hover:text-white"}`}
          >
            {l}
          </Link>
        ))}
      </nav>

      {adding ? (
        <section aria-labelledby="new-title" className="admin-card mt-6 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="new-title" className="text-[17px] font-semibold text-navy">
              New task
            </h2>
            <Link href={href({})} className="t-small font-semibold text-navy underline underline-offset-4">
              Close
            </Link>
          </div>
          <form action={createTaskAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="keep" value={keep.toString()} />
            <TaskFields people={team} />
            <div className="md:col-span-2">
              <button type="submit" className="admin-btn">
                Add task
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="mt-6">
        <BoardColumns columns={STATUSES.map((s) => ({ key: s.key, label: s.label }))} cards={cards} linked={linked} move={moveTaskAction} />
      </div>

      {taskId ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-navy/40" role="presentation">
          <Link href={href({})} aria-label="Close task" className="absolute inset-0" />
          <section role="dialog" aria-modal="true" aria-labelledby="task-title" className="relative h-full w-full max-w-[640px] overflow-y-auto bg-white p-5 shadow-[-12px_0_40px_rgba(0,43,78,0.2)] md:p-7">
            {!t ? (
              <>
                <p className="text-secondary">That task no longer exists.</p>
                <Link href={href({})} className="mt-4 inline-block font-semibold text-navy underline underline-offset-4">
                  Back to the board
                </Link>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="t-caption uppercase tracking-[0.04em] text-secondary">
                      {STATUSES.find((s) => s.key === t.status)?.label} · added by {t.created_by_name}, {requestDate(t.created_at)}
                    </p>
                    <h2 id="task-title" className="mt-1 text-[22px] font-semibold leading-tight text-navy">
                      {t.title}
                    </h2>
                  </div>
                  <Link href={href({})} className="shrink-0 t-small font-semibold text-navy underline underline-offset-4">
                    Close
                  </Link>
                </div>
                {one(params.error) ? (
                  <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error-soft px-3 py-2 t-small font-medium text-error">
                    {one(params.error)}
                  </p>
                ) : null}
                {one(params.saved) === "updated" ? (
                  <p role="status" className="mt-4 rounded-md bg-success-soft px-3 py-2 t-small font-medium text-success">
                    Saved.
                  </p>
                ) : null}

                <form action={updateTaskAction} className="mt-5 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="keep" value={keep.toString()} />
                  <TaskFields task={t} people={team} />
                  <div className="md:col-span-2">
                    <button type="submit" className="admin-btn">
                      Save task
                    </button>
                  </div>
                </form>

                <section aria-labelledby="check-title" className="mt-7 border-t border-line pt-5">
                  <h3 id="check-title" className="font-semibold text-navy">
                    Checklist {t.checklist.length ? <span className="font-normal text-secondary">({checklistProgress(t.checklist).done}/{t.checklist.length})</span> : null}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {t.checklist.map((item, i) => (
                      <li key={`${i}-${item.text}`} className="flex items-center gap-2">
                        <form action={checklistAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="keep" value={keep.toString()} />
                          <input type="hidden" name="index" value={i} />
                          <button type="submit" name="op" value="toggle" aria-label={item.done ? `Untick ${item.text}` : `Tick ${item.text}`} className={`inline-flex size-5 items-center justify-center rounded border ${item.done ? "border-success bg-success text-white" : "border-line-strong bg-white"}`}>
                            {item.done ? "✓" : ""}
                          </button>
                        </form>
                        <span className={`flex-1 t-small ${item.done ? "text-secondary line-through" : "text-navy"}`}>{item.text}</span>
                        <form action={checklistAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="keep" value={keep.toString()} />
                          <input type="hidden" name="index" value={i} />
                          <button type="submit" name="op" value="remove" className="t-caption text-secondary hover:text-error" aria-label={`Remove ${item.text}`}>
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <form action={checklistAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="keep" value={keep.toString()} />
                    <input name="text" maxLength={200} placeholder="Add an item" aria-label="New checklist item" className="admin-input !min-h-10" />
                    <button type="submit" name="op" value="add" className="admin-btn-secondary">
                      Add
                    </button>
                  </form>
                </section>

                <section aria-labelledby="comments-title" className="mt-7 border-t border-line pt-5">
                  <h3 id="comments-title" className="font-semibold text-navy">
                    Comments
                  </h3>
                  <ol className="mt-2 space-y-3">
                    {detail!.comments.map((c) => (
                      <li key={c.id} className="rounded-md bg-soft p-3">
                        <p className="t-caption text-secondary">
                          <span className="font-semibold text-navy">{c.author_name}</span> · {requestDate(c.created_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-line t-small text-body">{c.body}</p>
                      </li>
                    ))}
                  </ol>
                  <form action={commentAction} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="keep" value={keep.toString()} />
                    <textarea name="body" required maxLength={2000} rows={2} placeholder="Write a comment" aria-label="Comment" className="admin-input" />
                    <button type="submit" className="admin-btn-secondary">
                      Comment
                    </button>
                  </form>
                </section>

                {canArchiveTasks(admin.role) ? (
                  <form action={archiveTaskAction} className="mt-7 border-t border-line pt-5">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="keep" value={keep.toString()} />
                    <button type="submit" className="admin-btn-danger">
                      Archive task
                    </button>
                    <p className="mt-1 t-caption text-secondary">Archived tasks leave the board; the change stays in Activity.</p>
                  </form>
                ) : null}
                {t.assignee_name ? (
                  <p className="mt-6">
                    <Badge tone="blue">Assigned to {t.assignee_name}</Badge>
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
