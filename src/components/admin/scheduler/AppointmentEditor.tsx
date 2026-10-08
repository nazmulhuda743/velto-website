"use client";
import { cloneElement, useEffect, useRef, useState } from "react";
import { useSchedulerText } from "./SchedulerLanguage";
import {
  saveAppointment,
  searchScheduler,
} from "@/app/admin/scheduler-actions";
import {
  active,
  dhakaDate,
  exactInterval,
  localTime,
  PROCESSING_STAGES,
  schedulerError,
  timeGrid,
  type Appointment,
  type AppointmentKind,
  type SchedulerBoard,
  type SearchCustomer,
  type SearchOrder,
  type SearchResult,
} from "@/lib/scheduler/logic";
import { normaliseBdPhone } from "@/lib/customer/validation";
export function AppointmentEditor({
  board,
  day,
  initialKind,
  item,
  time,
  canOverride,
  onClose,
  onSaved,
}: {
  board: SchedulerBoard;
  day: string;
  initialKind: AppointmentKind;
  item?: Appointment;
  time?: string;
  canOverride: boolean;
  onClose: () => void;
  onSaved: (existing: boolean) => void;
}) {
  const text = useSchedulerText();
  const dialog = useRef<HTMLDialogElement>(null);
  const [requestId] = useState(() => item?.id || crypto.randomUUID());
  const [kind, setKind] = useState<AppointmentKind>(item?.kind || initialKind);
  const [mode, setMode] = useState<"existing" | "new">(
    item && !item.customer_id ? "new" : "existing",
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState(item?.contact_name || "");
  const [phone, setPhone] = useState(item?.phone_key || "");
  const [whatsapp, setWhatsapp] = useState(item?.whatsapp || "");
  const [area, setArea] = useState(item?.area || "");
  const [address, setAddress] = useState(item?.address || "");
  const [order, setOrder] = useState(item?.order_number || "");
  const [orderInfo, setOrderInfo] = useState<SearchOrder | null>(null);
  const [date, setDate] = useState(
    item?.scheduled_start
      ? dhakaDate(new Date(item.scheduled_start))
      : item?.slot_date || day,
  );
  const [at, setAt] = useState(
    item?.scheduled_start ? localTime(item.scheduled_start) : time || "09:00",
  );
  const [duration, setDuration] = useState(
    item?.scheduled_end && item?.scheduled_start
      ? Math.round(
          (Date.parse(item.scheduled_end) - Date.parse(item.scheduled_start)) /
            60000,
        )
      : 30,
  );
  const [assignee, setAssignee] = useState(item?.assignee_id || "");
  const [outlet, setOutlet] = useState(
    item?.outlet_code || board.outlets[0]?.code || "",
  );
  const [stage, setStage] = useState(item?.processing_stage || "intake");
  const [service, setService] = useState(item?.service || "");
  const [source, setSource] = useState(
    item
      ? ["website_booking", "ops_order"].includes(item.source)
        ? "website"
        : item.source
      : "phone",
  );
  const [promised, setPromised] = useState(
    item?.promised_window || item?.slot || "",
  );
  const [notes, setNotes] = useState(item?.notes || "");
  const [block, setBlock] = useState(item?.blocking_reason || "");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [matched, setMatched] = useState<SearchCustomer | null>(null);
  const closed = item && !active(item);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      searchScheduler(query)
        .then((r) => {
          if (current) setResults(r);
        })
        .catch(() => {
          if (current) setResults({ ok: false, error: "unavailable" });
        })
        .finally(() => {
          if (current) setSearching(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    if (kind !== "pickup" || !normaliseBdPhone(phone)) return;
    let current = true;
    const timer = setTimeout(() => {
      searchScheduler(phone)
        .then((r) => {
          if (current && r.ok)
            setMatched(
              r.customers.find(
                (c) => normaliseBdPhone(c.phone) === normaliseBdPhone(phone),
              ) ?? null,
            );
        })
        .catch(() => {});
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [phone, kind]);
  function pickCustomer(c: SearchCustomer) {
    setName(c.name);
    setPhone(c.phone);
    setWhatsapp(c.whatsapp || "");
    setArea(c.zone || "");
    setAddress(c.address || "");
    setMatched(c);
    setQuery("");
    setResults(null);
  }
  function pickOrder(o: SearchOrder) {
    setOrder(o.order_number);
    setOrderInfo(o);
    setName(o.name);
    setPhone(o.phone);
    setArea(o.zone || "");
    setAddress(o.address || "");
    setOutlet(o.outlet_code);
    setQuery("");
    setResults(null);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const interval = exactInterval(date, at, duration);
    if (!interval) {
      setError("invalid_time");
      return;
    }
    if (kind === "pickup" && !normaliseBdPhone(phone)) {
      setError("customer");
      return;
    }
    if (override && !overrideReason.trim()) {
      setError("reason");
      return;
    }
    setSaving(true);
    const result = await saveAppointment({
      id: requestId,
      ...(item?.id ? { version: item.version } : {}),
      kind,
      dispatch_job_id: item?.dispatch_job_id || null,
      name,
      phone: normaliseBdPhone(phone) || phone,
      whatsapp,
      area,
      address,
      order_number: order || null,
      ...interval,
      assignee_id: assignee || null,
      outlet_code: outlet,
      processing_stage: kind === "processing" ? stage : null,
      service,
      source,
      notes,
      blocking_reason: block,
      promised_date: item?.promised_date || item?.slot_date || date,
      promised_window: promised || null,
      override_reason: override ? overrideReason : null,
    }).catch(() => ({ ok: false as const, error: "unavailable" }));
    setSaving(false);
    if (result.ok) onSaved(Boolean(result.existing_customer));
    else setError(result.error);
  }
  const people = board.people.filter(
    (p) => kind === "processing" || p.can_ride,
  );
  const chosen = board.windows.find((w) => w.id === promised);
  const outside =
    kind !== "processing" &&
    chosen &&
    (at < chosen.starts ||
      localTime(exactInterval(date, at, duration)?.end || null) > chosen.ends ||
      date !== (item?.promised_date || item?.slot_date || date));
  const field = (
    label: string,
    child: React.ReactElement<{ "aria-label"?: string }>,
    hint?: string,
  ) => (
    <label className="schedule-field">
      <span>{label}</span>
      {cloneElement(child, { "aria-label": label })}
      {hint && <small>{hint}</small>}
    </label>
  );
  return (
    <dialog
      ref={dialog}
      className="schedule-dialog"
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else onClose();
      }}
    >
      <div className="schedule-dialog-heading">
        <div>
          <p className="schedule-eyebrow">
            {item?.id ? text("APPOINTMENT DETAILS") : text("PLAN THE NEXT JOB")}
          </p>
          <h2>
            {closed
              ? text("Appointment history")
              : item?.id
                ? text("Edit appointment")
                : text("New appointment")}
          </h2>
        </div>
        <button
          type="button"
          aria-label={text("Close appointment")}
          disabled={saving}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <form onSubmit={submit} className="schedule-form">
        <fieldset disabled={saving || closed}>
          {!item && (
            <div
              className="schedule-type-picker"
              aria-label={text("Appointment type")}
            >
              {(
                [
                  "pickup",
                  "delivery",
                  ...(board.can_process ? ["processing"] : []),
                ] as AppointmentKind[]
              ).map((k) => (
                <button
                  type="button"
                  aria-pressed={kind === k}
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setAssignee("");
                    setOrder("");
                    setOrderInfo(null);
                    setResults(null);
                  }}
                >
                  {text(k[0].toUpperCase() + k.slice(1))}
                </button>
              ))}
            </div>
          )}
          <section>
            <h3>
              1. {kind === "pickup" ? text("Customer") : text("Order & work")}
            </h3>
            {kind === "pickup" && !item && (
              <div className="schedule-customer-mode">
                <button
                  type="button"
                  aria-pressed={mode === "existing"}
                  onClick={() => setMode("existing")}
                >
                  {text("Existing customer")}
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "new"}
                  onClick={() => {
                    setMode("new");
                    setQuery("");
                    setResults(null);
                  }}
                >
                  {text("New customer")}
                </button>
              </div>
            )}
            {!item && (kind !== "pickup" || mode === "existing") && (
              <div className="schedule-search">
                {field(
                  kind === "pickup"
                    ? text("Find a customer")
                    : text("Find an order"),
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setResults(null);
                    }}
                    placeholder={text("Phone, name or VEL order number")}
                    autoComplete="off"
                    maxLength={80}
                  />,
                )}
                {searching && <p role="status">{text("Searching…")}</p>}
                {results && !results.ok && (
                  <p role="alert">{schedulerError(results.error)}</p>
                )}
                {results?.ok && query.length >= 2 && (
                  <div className="schedule-search-results">
                    {kind === "pickup" &&
                      results.customers.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => pickCustomer(c)}
                        >
                          <strong>{c.name}</strong>
                          <span>
                            {text("Customer ·")} {c.customer_code} · {c.phone}
                          </span>
                        </button>
                      ))}
                    {results.orders.map((o) => (
                      <button
                        disabled={
                          kind !== "pickup" &&
                          ["Cancelled", "Delivered"].includes(o.order_status)
                        }
                        type="button"
                        key={o.order_number}
                        onClick={() =>
                          kind === "pickup"
                            ? pickCustomer({
                                id: "",
                                customer_code: "",
                                name: o.name,
                                phone: o.phone,
                                whatsapp: null,
                                address: o.address,
                                zone: o.zone,
                              })
                            : pickOrder(o)
                        }
                      >
                        <strong>
                          {o.order_number} · {o.name}
                        </strong>
                        <span>
                          {text("Order ·")} {o.order_status} · ৳{o.due}{" "}
                          {text("due")}
                        </span>
                      </button>
                    ))}
                    {!results.customers.length && !results.orders.length && (
                      <p>
                        {text("No")}{" "}
                        {kind === "pickup"
                          ? text("Velto customer")
                          : text("order")}{" "}
                        {text("found.")}
                      </p>
                    )}
                    {kind === "pickup" && !results.customers.length && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("new");
                          if (normaliseBdPhone(query)) setPhone(query);
                          setQuery("");
                          setResults(null);
                        }}
                      >
                        {text("Create appointment for new customer →")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {kind !== "pickup" && (
              <>
                {field(
                  text("Order number"),
                  <input
                    required
                    value={order}
                    readOnly={Boolean(item)}
                    onChange={(e) => setOrder(e.target.value.toUpperCase())}
                    placeholder="VEL-01934"
                    pattern="VELR?-[0-9]{3,6}"
                  />,
                )}
                {orderInfo && (
                  <p className="schedule-selection">
                    <strong>{orderInfo.name}</strong>
                    <br />
                    {orderInfo.order_status} · ৳{orderInfo.due} {text("due")}
                    <br />
                    {orderInfo.address}
                  </p>
                )}
                {kind === "delivery" && (
                  <p className="schedule-hint">
                    {text(
                      "Orders that are not ready can be planned for a future day. Delivery starts only after Ready.",
                    )}
                  </p>
                )}
              </>
            )}
            {kind === "pickup" && (
              <>
                <div className="schedule-form-grid">
                  {field(
                    text("Customer name"),
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      minLength={2}
                      maxLength={120}
                      readOnly={Boolean(item)}
                    />,
                  )}
                  {field(
                    text("Mobile number"),
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setMatched(null);
                      }}
                      maxLength={20}
                      readOnly={Boolean(item)}
                    />,
                  )}
                </div>
                {matched && (
                  <p className="schedule-success">
                    {text("Existing Velto customer found:")} {matched.name}
                    {text(". This appointment will link to that customer.")}
                  </p>
                )}
                {!matched && mode === "new" && (
                  <p className="schedule-hint">
                    {text("No previous order needed. Book the pickup now.")}
                  </p>
                )}
                <div className="schedule-form-grid">
                  {field(
                    text("Sector / area"),
                    <input
                      required
                      list="schedule-sectors"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      maxLength={120}
                      readOnly={Boolean(item)}
                    />,
                  )}
                  {field(
                    text("WhatsApp, if different"),
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      maxLength={32}
                    />,
                  )}
                </div>
                <datalist id="schedule-sectors">
                  {Array.from({ length: 18 }, (_, i) => (
                    <option key={i} value={`Sector ${i + 1}`} />
                  ))}
                </datalist>
                {field(
                  text("Pickup address"),
                  <textarea
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    minLength={3}
                    maxLength={500}
                    readOnly={Boolean(item)}
                  />,
                )}
              </>
            )}
            {kind === "processing" &&
              field(
                text("Processing stage"),
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {PROCESSING_STAGES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {text(label)}
                    </option>
                  ))}
                </select>,
              )}
          </section>
          <section>
            <h3>{text("2. Time & assignment")}</h3>
            <div className="schedule-form-grid">
              {field(
                text("Date"),
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />,
              )}
              {field(
                text("Exact start · Dhaka"),
                <select value={at} onChange={(e) => setAt(e.target.value)}>
                  {[
                    ...new Set([
                      ...timeGrid(
                        board.config.starts_at,
                        board.config.ends_at,
                        board.config.interval_minutes,
                      ),
                      at,
                    ]),
                  ]
                    .sort()
                    .map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                </select>,
              )}
              {field(
                text("Duration"),
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {[15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 600, 720].map(
                    (n) => (
                      <option key={n} value={n}>
                        {n} {text("minutes")}
                      </option>
                    ),
                  )}
                </select>,
              )}
              {field(
                kind === "processing"
                  ? text("Worker / resource")
                  : text("Rider"),
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">{text("Unassigned")}</option>
                  {people.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={kind !== "processing" && date === day && p.off}
                    >
                      {p.name}
                      {p.off && date === day ? text(" · off today") : ""}
                    </option>
                  ))}
                </select>,
              )}
            </div>
            {field(
              text("Outlet / facility"),
              <select
                required
                value={outlet}
                onChange={(e) => setOutlet(e.target.value)}
              >
                {board.outlets.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>,
            )}
            {kind !== "processing" && (
              <>
                {field(
                  text("Customer’s promised window"),
                  <select
                    value={promised}
                    disabled={Boolean(item?.promised_window || item?.slot)}
                    onChange={(e) => setPromised(e.target.value)}
                  >
                    <option value="">
                      {text("Use the window containing this time")}
                    </option>
                    {board.windows
                      .filter((w) => w.active)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.id[0].toUpperCase() + w.id.slice(1)} · {w.starts}–
                          {w.ends}
                        </option>
                      ))}
                  </select>,
                  item?.promised_date ||
                    item?.slot_date ||
                    text(
                      "The customer keeps their broad window; this time is for the team.",
                    ),
                )}
              </>
            )}
            {outside && (
              <p role="status" className="schedule-warning">
                {text(
                  "Outside the customer’s promise. Confirm the new time with the customer before overriding.",
                )}
              </p>
            )}
            {canOverride && kind !== "processing" && (
              <details
                open={Boolean(
                  error === "outside_customer_window" ||
                  error === "slot_full" ||
                  outside,
                )}
              >
                <summary>{text("Manager override")}</summary>
                <label className="schedule-check">
                  <input
                    type="checkbox"
                    checked={override}
                    onChange={(e) => setOverride(e.target.checked)}
                  />
                  {text("Override customer window or broad capacity")}
                </label>
                {override &&
                  field(
                    text("Reason for override"),
                    <textarea
                      required
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      maxLength={200}
                    />,
                  )}
                <p className="schedule-hint">
                  {text(
                    "An overlapping rider or worker booking cannot be overridden.",
                  )}
                </p>
              </details>
            )}
          </section>
          <section>
            <h3>{text("3. Useful details")}</h3>
            <div className="schedule-form-grid">
              {field(
                text("Service interest"),
                <input
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder={text("Optional")}
                  maxLength={120}
                />,
              )}
              {field(
                text("Booking source"),
                <select
                  value={source}
                  disabled={Boolean(item)}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {[
                    "phone",
                    "whatsapp",
                    "walk-in",
                    "manager",
                    "website",
                    "weekly",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {text(s)}
                    </option>
                  ))}
                </select>,
              )}
            </div>
            {field(
              text("Notes"),
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                placeholder={text(
                  "Access instructions, items or anything the team should know",
                )}
              />,
            )}
            {kind === "processing" &&
              field(
                text("Blocking reason, if any"),
                <input
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  maxLength={300}
                  placeholder={text("Optional")}
                />,
              )}
          </section>
        </fieldset>
        {closed && (
          <p className="schedule-selection">
            {item.status === "completed"
              ? text("Completed")
              : text("Cancelled")}
            {text("· preserved in Activity history.")}
          </p>
        )}
        {error && (
          <p className="schedule-error" role="alert">
            {text(schedulerError(error))}
          </p>
        )}
        <div className="schedule-dialog-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            {closed ? text("Close") : text("Close without saving")}
          </button>
          {!closed && (
            <button className="schedule-primary" disabled={saving}>
              {saving
                ? text("Saving…")
                : item?.id
                  ? text("Save changes")
                  : text("Save appointment")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
