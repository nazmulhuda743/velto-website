"use client";
import Link from "next/link";
import { LangSwitch } from "../today/LangSwitch";
import { SchedulerLanguage, useSchedulerText } from "./SchedulerLanguage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadScheduler,
  transitionAppointment,
} from "@/app/admin/scheduler-actions";
import {
  active,
  appointmentLabel,
  dhakaDate,
  localTime,
  PROCESSING_STAGES,
  schedulerError,
  shiftDay,
  timeGrid,
  type Appointment,
  type AppointmentKind,
  type SchedulerBoard,
} from "@/lib/scheduler/logic";
import { AppointmentEditor } from "./AppointmentEditor";
import "./scheduler.css";
export function Scheduler(props: {
  initial: SchedulerBoard;
  initialDay: string;
  preview: boolean;
  canOverride: boolean;
  lang: "en" | "bn";
}) {
  return (
    <SchedulerLanguage lang={props.lang}>
      <SchedulerView {...props} />
    </SchedulerLanguage>
  );
}
const names = {
  pickup: "Pickup",
  delivery: "Delivery",
  processing: "Processing",
};
function SchedulerView({
  initial,
  initialDay,
  preview,
  canOverride,
  lang,
}: {
  initial: SchedulerBoard;
  initialDay: string;
  preview: boolean;
  canOverride: boolean;
  lang: "en" | "bn";
}) {
  const text = useSchedulerText();
  const [board, setBoard] = useState(initial);
  const [day, setDay] = useState(initialDay);
  const [lane, setLane] = useState<"all" | AppointmentKind>("all");
  const [person, setPerson] = useState("");
  const [outlet, setOutlet] = useState("");
  const [status, setStatus] = useState("active");
  const [editor, setEditor] = useState<{
    item?: Appointment;
    time?: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const dayRef = useRef(day);
  const requesting = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const reload = useCallback(async (quiet = true) => {
    if (requesting.current) return;
    requesting.current = true;
    const target = dayRef.current;
    if (!quiet) setLoading(true);
    try {
      const result = await loadScheduler(target);
      if (target !== dayRef.current) return;
      if (result.ok) {
        setBoard(result);
        setError("");
      } else setError(schedulerError(result.error));
    } catch {
      setError(schedulerError("unavailable"));
    } finally {
      requesting.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = setInterval(tick, 5000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [reload]);
  async function changeDay(next: string) {
    if (!next) return;
    dayRef.current = next;
    setDay(next);
    setLoading(true);
    const result = await loadScheduler(next).catch(() => ({
      ok: false as const,
      error: "unavailable",
    }));
    if (dayRef.current !== next) return;
    setLoading(false);
    if (result.ok) {
      setBoard(result);
      setError("");
    } else setError(schedulerError(result.error));
  }
  function closeEditor() {
    setEditor(null);
    setTimeout(() => addButton.current?.focus(), 0);
  }
  async function move(a: Appointment, next: string, note = "") {
    if (!a.id) return;
    setBusy(a.id);
    const r = await transitionAppointment(a.id, a.version, next, note).catch(
      () => ({ ok: false as const, error: "unavailable" }),
    );
    setBusy(null);
    if (r.ok) {
      setNotice(
        next === "completed"
          ? text("Appointment completed.")
          : next === "cancelled"
            ? text("Appointment cancelled.")
            : text("Work started."),
      );
      setCancel(null);
      setReason("");
      await reload();
    } else setError(schedulerError(r.error));
  }
  const allowed = (a: Appointment) =>
    (lane === "all" || a.kind === lane) &&
    (!person || a.assignee_id === person) &&
    (!outlet || a.outlet_code === outlet);
  const matches = (a: Appointment) =>
    allowed(a) &&
    (status === "all" || status === "active"
      ? status === "all" || active(a)
      : a.status === status);
  const all = board.appointments.filter(matches);
  const unscheduled = board.unscheduled.filter(allowed);
  const attention = [
    ...all.filter(
      (a) =>
        active(a) &&
        (!a.assignee_id || !a.scheduled_start || a.blocking_reason),
    ),
    ...unscheduled,
  ];
  const scheduled = all.filter((a) => a.scheduled_start);
  const slots = [
    ...new Set([
      ...timeGrid(
        board.config.starts_at,
        board.config.ends_at,
        board.config.interval_minutes,
      ),
      ...scheduled.map((a) => localTime(a.scheduled_start)),
    ]),
  ].sort();
  const now = new Date(board.loaded_at).getTime();
  const dateLabel = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${day}T12:00:00+06:00`));
  const card = (a: Appointment, compact = false) => (
    <article
      className={`schedule-card schedule-${a.kind} ${a.status === "cancelled" ? "schedule-muted" : ""}`}
      key={a.id || a.dispatch_job_id}
    >
      <div className="schedule-card-top">
        <span className="schedule-kind">{text(names[a.kind])}</span>
        <span
          className={`schedule-status ${!a.assignee_id && active(a) ? "schedule-warning" : ""}`}
        >
          {text(appointmentLabel(a))}
        </span>
      </div>
      <h3>
        {a.order_number && a.kind !== "pickup" ? (
          <>
            <span>{a.order_number}</span>
            <small>{a.contact_name}</small>
          </>
        ) : (
          a.contact_name
        )}
      </h3>
      <p>
        {a.kind === "processing"
          ? text(
              PROCESSING_STAGES.find((s) => s[0] === a.processing_stage)?.[1] ||
                "",
            )
          : a.area || text("Address needs checking")}
        {a.scheduled_end && a.scheduled_start
          ? ` · ${localTime(a.scheduled_start)}–${localTime(a.scheduled_end)}`
          : ""}
      </p>
      <div className="schedule-card-meta">
        <span>{a.assignee_name || text("Needs assignment")}</span>
        {a.kind === "delivery" && Number(a.due) > 0 ? (
          <strong>
            ৳{Number(a.due).toLocaleString("en-BD")} {text("due")}
          </strong>
        ) : (
          <span>
            {board.outlets.find((o) => o.code === a.outlet_code)?.name}
          </span>
        )}
      </div>
      {!a.scheduled_start && (
        <p className="schedule-promise">
          {a.slot_date || a.promised_date || text("Date not set")} ·{" "}
          {a.slot || a.promised_window || a.requested || text("Window not set")}
          <br />
          {text("Exact time not assigned")}
        </p>
      )}
      {a.blocking_reason && (
        <p className="schedule-warning">{a.blocking_reason}</p>
      )}
      {a.scheduled_end && Date.parse(a.scheduled_end) < now && active(a) && (
        <p className="schedule-late">{text("Overdue · check progress")}</p>
      )}
      <div className="schedule-card-actions">
        {a.phone_key && <a href={`tel:${a.phone_key}`}>{text("Call")}</a>}
        {(a.whatsapp || a.phone_key) && (
          <a
            href={`https://wa.me/${(a.whatsapp || a.phone_key || "").replace(/\D/g, "").replace(/^0/, "880")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        )}
        <button onClick={() => setEditor({ item: a })}>
          {active(a)
            ? a.scheduled_start
              ? text("View / edit")
              : text("Schedule")
            : text("View details")}
        </button>
        {!compact && active(a) && a.id && (
          <>
            <button
              disabled={busy === a.id || !a.assignee_id}
              onClick={() =>
                void move(
                  a,
                  a.status === "in_progress" ? "completed" : "in_progress",
                )
              }
            >
              {a.status === "in_progress" ? text("Complete") : text("Start")}
            </button>
            <button
              aria-label={`Cancel ${a.contact_name} ${names[a.kind].toLowerCase()}`}
              onClick={() => {
                setCancel(a);
                setReason("");
              }}
            >
              {text("Cancel")}
            </button>
          </>
        )}
      </div>
    </article>
  );
  return (
    <div className="scheduler" lang={lang}>
      <header className="schedule-header">
        <div>
          <p className="schedule-eyebrow">{text("VELTO / DAILY OPERATIONS")}</p>
          <h1>
            {day === dhakaDate()
              ? text("Today")
              : day === shiftDay(dhakaDate(), 1)
                ? text("Tomorrow")
                : text("Daily schedule")}
          </h1>
          <p>
            {dateLabel} <span>{text("· Dhaka time")}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitch lang={lang} label="Language" />
          <button
            ref={addButton}
            className="schedule-primary"
            onClick={() => setEditor({})}
          >
            {text("+ New Appointment")}
          </button>
        </div>
      </header>
      {preview && (
        <p className="schedule-preview">
          {text("Local preview · synthetic customers and appointments")}
        </p>
      )}
      <div className="schedule-toolbar">
        <div className="schedule-days">
          <button
            aria-label={text("Previous day")}
            onClick={() => void changeDay(shiftDay(day, -1))}
          >
            ←
          </button>
          <button onClick={() => void changeDay(dhakaDate())}>
            {text("Today")}
          </button>
          <button onClick={() => void changeDay(shiftDay(dhakaDate(), 1))}>
            {text("Tomorrow")}
          </button>
          <button
            aria-label={text("Next day")}
            onClick={() => void changeDay(shiftDay(day, 1))}
          >
            →
          </button>
          <label>
            <span className="sr-only">{text("Schedule date")}</span>
            <input
              type="date"
              value={day}
              onChange={(e) => void changeDay(e.target.value)}
            />
          </label>
        </div>
        <span className="schedule-live">
          {loading
            ? text("Loading…")
            : error
              ? text("Connection interrupted")
              : text("Updates every 5 seconds")}
        </span>
      </div>
      <nav className="schedule-lanes" aria-label={text("Appointment type")}>
        {(
          [
            "all",
            "pickup",
            "delivery",
            ...(board.can_process ? ["processing"] : []),
          ] as ("all" | AppointmentKind)[]
        ).map((k) => (
          <button key={k} aria-pressed={lane === k} onClick={() => setLane(k)}>
            {k === "all" ? text("All") : text(names[k])}
            <span>
              {board.appointments.filter(
                (a) => active(a) && (k === "all" || a.kind === k),
              ).length +
                board.unscheduled.filter((a) => k === "all" || a.kind === k)
                  .length}
            </span>
          </button>
        ))}
      </nav>
      <div className="schedule-filters">
        <label>
          <span>{text("Person")}</span>
          <select
            aria-label={text("Person")}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="">{text("Everyone")}</option>
            {board.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{text("Outlet")}</span>
          <select
            aria-label={text("Outlet")}
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
          >
            <option value="">{text("All outlets")}</option>
            {board.outlets.map((o) => (
              <option value={o.code} key={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{text("Show")}</span>
          <select
            aria-label={text("Show")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">{text("Active work")}</option>
            <option value="all">{text("All, including history")}</option>
            <option value="completed">{text("Completed")}</option>
            <option value="cancelled">{text("Cancelled")}</option>
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="schedule-success">
          {text(notice)}
          <button
            aria-label={text("Dismiss notice")}
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="schedule-error">
          {text(error)}{" "}
          <button onClick={() => void reload(false)}>{text("Retry")}</button>
        </p>
      )}
      <div className="schedule-layout" aria-busy={loading}>
        <aside className="schedule-attention">
          <div className="schedule-section-title">
            <h2>{text("Needs attention")}</h2>
            <span>{attention.length}</span>
          </div>
          <p className="schedule-section-note">
            {text("Set a time, assign a person, resolve a blocker.")}
          </p>
          {attention.length ? (
            attention.map((a) => card(a, true))
          ) : (
            <div className="schedule-empty">
              <strong>{text("Everything has a plan.")}</strong>
              <p>{text("No unassigned or blocked work.")}</p>
            </div>
          )}
          <Link
            className="schedule-secondary-link"
            href="/admin/today?tab=call"
          >
            {text("Requests & routes →")}
          </Link>
          <Link className="schedule-secondary-link" href="/admin/activity">
            {text("Activity history →")}
          </Link>
        </aside>
        <section className="schedule-timeline">
          <div className="schedule-section-title">
            <h2>{text("Day timeline")}</h2>
            <span>
              {scheduled.length} {text("appointments")}
            </span>
          </div>
          {loading ? (
            <p className="schedule-empty">
              {text("Loading this day’s schedule…")}
            </p>
          ) : (
            slots.map((time) => {
              const items = scheduled.filter(
                (a) => localTime(a.scheduled_start) === time,
              );
              const past = Date.parse(`${day}T${time}:00+06:00`) < now;
              return (
                <div
                  className={`schedule-hour ${past ? "schedule-hour-past" : ""}`}
                  key={time}
                >
                  <time>{time}</time>
                  <div>
                    {items.length ? (
                      items.map((a) => card(a))
                    ) : (
                      <button
                        className="schedule-available"
                        disabled={
                          past ||
                          status === "completed" ||
                          status === "cancelled"
                        }
                        onClick={() => setEditor({ time })}
                      >
                        {past
                          ? text("Past")
                          : person &&
                              scheduled.some(
                                (a) =>
                                  active(a) &&
                                  a.assignee_id === person &&
                                  localTime(a.scheduled_start) <= time &&
                                  localTime(a.scheduled_end) > time,
                              )
                            ? text("Busy · work continues")
                            : text("Available · add appointment")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
      {editor && (
        <AppointmentEditor
          board={board}
          day={day}
          initialKind={lane === "all" ? "pickup" : lane}
          item={editor.item}
          time={editor.time}
          canOverride={canOverride}
          onClose={closeEditor}
          onSaved={async (existing) => {
            setNotice(
              existing
                ? text("Appointment saved · existing Velto customer linked.")
                : text("Appointment saved."),
            );
            closeEditor();
            await reload();
          }}
        />
      )}
      {cancel && (
        <CancelDialog
          name={cancel.contact_name}
          reason={reason}
          onReason={setReason}
          busy={busy === cancel.id}
          onClose={() => setCancel(null)}
          onConfirm={() => void move(cancel, "cancelled", reason)}
        />
      )}
    </div>
  );
}
function CancelDialog({
  name,
  reason,
  onReason,
  busy,
  onClose,
  onConfirm,
}: {
  name: string;
  reason: string;
  onReason: (s: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const text = useSchedulerText();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="schedule-dialog schedule-cancel"
      onCancel={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <h2>{text("Cancel appointment?")}</h2>
        <p>
          {name}
          {text("’s appointment will remain in history.")}
        </p>
        <label>
          {text("Reason")}
          <textarea
            required
            maxLength={300}
            value={reason}
            onChange={(e) => onReason(e.target.value)}
          />
        </label>
        <div className="schedule-dialog-actions">
          <button type="button" onClick={onClose}>
            {text("Keep appointment")}
          </button>
          <button
            className="schedule-primary"
            disabled={busy || !reason.trim()}
          >
            {busy ? text("Cancelling…") : text("Confirm cancellation")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
