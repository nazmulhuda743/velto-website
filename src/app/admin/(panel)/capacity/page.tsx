import Link from "next/link";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { StaffPickupFields } from "@/components/admin/StaffPickupFields";
import { formText } from "@/content/i18n/forms";
import { dhakaToday } from "@/lib/admin/dispatch-logic";
import { canEditCapacity } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { GARMENT_SERVICES } from "@/lib/booking-items";
import { getBoard, type Board, type BoardSlot } from "@/lib/capacity";
import { addDaysIso, fill, loadTone, OVERRIDE_REASONS, sectorsText, shortDate, windowHours, WINDOW_IDS, zoneProblems } from "@/lib/capacity-logic";
import { saveConfigAction, saveDefaultsAction, saveZonesAction, setSlotAction, staffBookAction } from "../../capacity-actions";

export const metadata = { title: "Capacity · Velto Command Center" };

const SAVED: Record<string, string> = {
  slot: "Saved. The website and the dispatch board use the new number straight away.",
  defaults: "Saved the usual capacity.",
  zones: "Saved the zones.",
  config: "Saved the settings.",
  booked: "Pickup booked. The window is reserved and the task is in Velto Ops.",
};

const WINDOW_NAME: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
const SERVICE_NAME: Record<string, string> = { "dry-cleaning": "Dry Cleaning", "wash-and-iron": "Wash & Iron", ironing: "Ironing" };
const SOURCE: Record<string, string> = { website: "Website", staff: "Staff", dispatch: "Dispatch" };

const TONE = {
  ok: { bar: "bg-success", text: "text-success" },
  busy: { bar: "bg-[#c98a00]", text: "text-[#8a5a00]" },
  full: { bar: "bg-error", text: "text-error" },
  closed: { bar: "bg-line-strong", text: "text-secondary" },
} as const;

function Bar({ used, capacity, blocked, label }: { used: number; capacity: number; blocked: boolean; label: string }) {
  const tone = loadTone(used, capacity, blocked);
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-soft" role="img" aria-label={label}>
      <span className={`block h-full rounded-full ${TONE[tone].bar}`} style={{ width: `${Math.round(fill(used, capacity) * 100)}%` }} />
    </span>
  );
}

const dayLabel = (d: string, today: string) => (d === today ? "Today" : d === addDaysIso(today, 1) ? "Tomorrow" : shortDate(d).slice(0, 3));

/** One zone in one window: the bar, who is booked, and (for managers) the day's number and block. */
function ZoneRow({ slot, zoneName, date, keep, canEdit }: { slot: BoardSlot; zoneName: string; date: string; keep: string; canEdit: boolean }) {
  const tone = loadTone(slot.used, slot.capacity, slot.blocked);
  const left = Math.max(0, slot.capacity - slot.used);
  const over = slot.reservations.filter((r) => r.over);
  return (
    <li className="py-3">
      <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0 truncate t-small font-semibold text-navy">{zoneName}</span>
        <Bar used={slot.used} capacity={slot.capacity} blocked={slot.blocked} label={`${slot.used} of ${slot.capacity} booked`} />
        <span className={`t-small font-semibold tabular-nums ${TONE[tone].text}`}>
          {slot.used}/{slot.capacity}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 t-caption text-secondary">
        {slot.blocked ? <Badge tone="neutral">Blocked{slot.note ? `: ${slot.note}` : ""}</Badge> : tone === "full" ? <Badge tone="amber">Full</Badge> : <span>{left} left</span>}
        {slot.override ? <span>Own number for this day</span> : null}
        {over.length ? <Badge tone="amber">{over.length} over capacity</Badge> : null}
      </div>
      {slot.reservations.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer t-caption font-semibold text-action hover:text-action-hover">
            {slot.reservations.length} {slot.reservations.length === 1 ? "booking" : "bookings"}
          </summary>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-soft">
            {slot.reservations.map((r) => (
              <li key={r.ref} className="grid gap-0.5 px-3 py-2 t-small sm:grid-cols-[minmax(0,1fr)_auto]">
                <span className="min-w-0">
                  <span className="font-semibold text-navy">{r.customerName ?? "Customer"}</span>
                  {r.area ? <span className="text-secondary"> · {r.area}</span> : null}
                  {r.orderNumber || r.taskRef ? <span className="text-secondary"> · {r.orderNumber ?? r.taskRef}</span> : null}
                  {r.over ? <span className="block t-caption text-[#8a5a00]">Over capacity: {r.reason ?? "no reason"}{r.by ? ` (${r.by})` : ""}</span> : null}
                </span>
                <span className="t-caption text-secondary">
                  {SOURCE[r.source] ?? r.source}
                  {r.status === "done" ? " · done" : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {canEdit ? (
        <details className="mt-2">
          <summary className="cursor-pointer t-caption font-semibold text-secondary hover:text-navy">Change this window</summary>
          <form action={setSlotAction} className="mt-2 grid gap-2 rounded-md border border-line bg-soft p-3 sm:grid-cols-[7rem_auto_minmax(0,1fr)_auto] sm:items-end">
            <input type="hidden" name="keep" value={keep} />
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="kind" value={slot.kind} />
            <input type="hidden" name="zone" value={slot.zone} />
            <input type="hidden" name="window" value={slot.window} />
            <label className="block t-caption font-semibold text-secondary">
              Capacity
              <input name="capacity" type="number" min={0} max={99} inputMode="numeric" defaultValue={slot.override ? slot.capacity : ""} placeholder={String(slot.capacity)} className="admin-input mt-1" />
            </label>
            <label className="flex items-center gap-2 pb-2 t-small text-navy">
              <input type="checkbox" name="blocked" defaultChecked={slot.blocked} className="size-4" />
              Block
            </label>
            <label className="block t-caption font-semibold text-secondary">
              Note (why)
              <input name="note" maxLength={200} defaultValue={slot.note ?? ""} placeholder="Rider off, Eid, rain…" className="admin-input mt-1" />
            </label>
            <button type="submit" className="admin-btn">
              Save
            </button>
            <p className="t-caption text-secondary sm:col-span-4">Blank capacity uses the usual number. Existing bookings stay; a lower number only stops new ones.</p>
          </form>
        </details>
      ) : null}
    </li>
  );
}

function KindBoard({ board, kind, keep, canEdit }: { board: Board; kind: "pickup" | "delivery"; keep: string; canEdit: boolean }) {
  const windows = board.windows.filter((w) => w.active);
  const zones = board.zones.filter((z) => z.active);
  const slots = board.slots.filter((s) => s.kind === kind);
  return (
    <section aria-labelledby={`${kind}-title`} className="min-w-0">
      <h2 id={`${kind}-title`} className="t-h4 text-navy">
        {kind === "pickup" ? "Pickups" : "Deliveries"}
      </h2>
      <div className="mt-3 space-y-4">
        {windows.map((w) => {
          const rows = zones.map((z) => ({ z, s: slots.find((s) => s.zone === z.id && s.window === w.id) })).filter((x): x is { z: (typeof zones)[number]; s: BoardSlot } => !!x.s);
          const used = rows.reduce((n, x) => n + x.s.used, 0);
          const cap = rows.reduce((n, x) => n + (x.s.blocked ? 0 : x.s.capacity), 0);
          return (
            <div key={w.id} id={`${kind}-${w.id}`} className="admin-card scroll-mt-24 p-4 md:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-semibold text-navy">
                  {WINDOW_NAME[w.id]} <span className="font-normal text-secondary">{windowHours(w.starts, w.ends)}</span>
                </h3>
                <span className="t-small font-semibold tabular-nums text-navy">
                  {used}/{cap} <span className="font-normal text-secondary">booked</span>
                </span>
              </div>
              <div className="mt-2">
                <Bar used={used} capacity={cap} blocked={false} label={`${used} of ${cap} booked in all zones`} />
              </div>
              <ul className="mt-2 divide-y divide-line">
                {rows.map(({ z, s }) => (
                  <ZoneRow key={z.id} slot={s} zoneName={z.name} date={board.date} keep={keep} canEdit={canEdit} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BookForm({ keep, canEdit, days, today, windows }: { keep: string; canEdit: boolean; days: string[]; today: string; windows: Board["windows"] }) {
  const t = formText("en");
  return (
    <form action={staffBookAction} className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
      <input type="hidden" name="keep" value={keep} />
      <fieldset className="flex flex-wrap gap-4">
        <legend className="t-small font-semibold text-navy">Customer asked on</legend>
        {[
          ["whatsapp", "WhatsApp"],
          ["phone", "Phone call"],
        ].map(([v, l]) => (
          <label key={v} className="mt-1 flex items-center gap-2 t-small text-navy">
            <input type="radio" name="channel" value={v} defaultChecked={v === "whatsapp"} className="size-4" />
            {l}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block t-small font-semibold text-navy">Customer name</span>
          <input name="name" required minLength={2} maxLength={100} autoComplete="off" className="admin-input mt-1" />
        </label>
        <label className="block">
          <span className="block t-small font-semibold text-navy">Phone</span>
          <input name="phone" required type="tel" inputMode="tel" maxLength={32} autoComplete="off" placeholder="01XXXXXXXXX" className="admin-input mt-1" />
        </label>
      </div>
      <StaffPickupFields t={t.booking} c={t.common} />
      <label className="block">
        <span className="block t-small font-semibold text-navy">Address</span>
        <input name="address" required minLength={5} maxLength={500} autoComplete="off" placeholder="House, road, floor" className="admin-input mt-1" />
      </label>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="t-small font-semibold text-navy">Services (if they said)</legend>
        {GARMENT_SERVICES.map((s) => (
          <label key={s} className="mt-1 flex items-center gap-2 t-small text-navy">
            <input type="checkbox" name="services" value={s} className="size-4" />
            {SERVICE_NAME[s]}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="block t-small font-semibold text-navy">Notes for the rider (optional)</span>
        <textarea name="notes" maxLength={600} rows={2} className="admin-input mt-1" />
      </label>
      {canEdit ? (
        // A full window can't be picked above. Owners and Managers can still book one, with a reason on record.
        <details>
          <summary className="cursor-pointer t-small font-semibold text-secondary hover:text-navy">Window full? Book over capacity</summary>
          <div className="mt-2 grid gap-2 rounded-md border border-line bg-soft p-3 sm:grid-cols-2">
            <select name="overDate" defaultValue="" className="admin-input" aria-label="Day to book over capacity">
              <option value="">Day…</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d, today)} {shortDate(d).slice(4)}
                </option>
              ))}
            </select>
            <select name="overWindow" defaultValue="" className="admin-input" aria-label="Window to book over capacity">
              <option value="">Window…</option>
              {windows.map((w) => (
                <option key={w.id} value={w.id}>
                  {WINDOW_NAME[w.id]} {windowHours(w.starts, w.ends)}
                </option>
              ))}
            </select>
            <select name="override" defaultValue="" className="admin-input" aria-label="Reason for booking over capacity">
              <option value="">Reason…</option>
              {OVERRIDE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="other">Other reason…</option>
            </select>
            <input name="overrideOther" maxLength={200} placeholder="Other reason" className="admin-input" aria-label="Other reason" />
            <p className="t-caption text-secondary sm:col-span-2">Filled in, this day and window are used instead of the one picked above, and the booking is marked over capacity with your reason.</p>
          </div>
        </details>
      ) : null}
      <div>
        <button type="submit" className="admin-btn">
          Book pickup
        </button>
      </div>
    </form>
  );
}

function Settings({ board, keep }: { board: Board; keep: string }) {
  const problems = zoneProblems(board.zones.filter((z) => z.id !== "other"));
  const zones = board.zones;
  const windows = board.windows;
  const dflt = (kind: string, zone: string, window: string) => board.defaults.find((d) => d.kind === kind && d.zone === zone && d.window === window)?.capacity ?? 0;
  return (
    <section id="settings" aria-labelledby="settings-title" className="mt-12 scroll-mt-24">
      <h2 id="settings-title" className="t-h4 text-navy">
        Settings
      </h2>
      <p className="mt-1 t-small text-secondary">Owners and Managers only. Changes apply to the website and the dispatch board at once.</p>

      <form action={saveConfigAction} className="admin-card mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 p-5">
        <input type="hidden" name="keep" value={keep} />
        <h3 className="font-semibold text-navy">Website booking</h3>
        <label className="flex items-start gap-3 t-small text-navy">
          <input type="checkbox" name="enabled" defaultChecked={board.config.enabled} className="mt-0.5 size-4" />
          <span>
            <span className="font-semibold">Customers book a window on the website</span>
            <span className="block text-secondary">Off: the website shows windows as a preference and Velto confirms by phone. Staff bookings here always use capacity.</span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block t-small font-semibold text-navy">
            Days ahead customers can book
            <input name="daysAhead" type="number" min={1} max={14} defaultValue={board.config.days_ahead} className="admin-input mt-1 block max-w-[8rem]" />
          </label>
          <label className="block t-small font-semibold text-navy">
            Stop selling a window (minutes before it ends)
            <input name="cutoff" type="number" min={0} max={600} step={15} defaultValue={board.config.cutoff_minutes} className="admin-input mt-1 block max-w-[8rem]" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] t-small">
            <thead>
              <tr className="text-left text-secondary">
                <th className="py-1 pr-3 font-semibold">Window</th>
                <th className="py-1 pr-3 font-semibold">From</th>
                <th className="py-1 pr-3 font-semibold">To</th>
                <th className="py-1 font-semibold">In use</th>
              </tr>
            </thead>
            <tbody>
              {WINDOW_IDS.map((id) => {
                const w = windows.find((x) => x.id === id);
                return (
                  <tr key={id} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold text-navy">{WINDOW_NAME[id]}</td>
                    <td className="py-2 pr-3">
                      <input name={`starts:${id}`} type="time" defaultValue={w?.starts ?? ""} className="admin-input" aria-label={`${WINDOW_NAME[id]} from`} />
                    </td>
                    <td className="py-2 pr-3">
                      <input name={`ends:${id}`} type="time" defaultValue={w?.ends ?? ""} className="admin-input" aria-label={`${WINDOW_NAME[id]} to`} />
                    </td>
                    <td className="py-2">
                      <input type="checkbox" name={`active:${id}`} defaultChecked={w?.active ?? false} className="size-4" aria-label={`${WINDOW_NAME[id]} in use`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <button type="submit" className="admin-btn">
            Save settings
          </button>
          <span className="ml-3 t-caption text-secondary">
            Last changed by {board.config.updated_by ?? "—"}
          </span>
        </div>
      </form>

      <form action={saveZonesAction} className="admin-card mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 p-5">
        <input type="hidden" name="keep" value={keep} />
        <h3 className="font-semibold text-navy">Zones</h3>
        <p className="t-small text-secondary">Sectors that share riders. Each Uttara sector belongs to one zone; addresses without a sector count under “Other”.</p>
        {problems.overlap.length || problems.missing.length ? (
          <p role="status" className="rounded-md border border-[#e8c46b] bg-[#fff8e6] px-3 py-2 t-small text-[#8a5a00]">
            {problems.missing.length ? `Not in any zone: Sector ${sectorsText(problems.missing)}. Customers there can't book a window. ` : ""}
            {problems.overlap.length ? `In more than one zone: Sector ${sectorsText(problems.overlap)}.` : ""}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] t-small">
            <thead>
              <tr className="text-left text-secondary">
                <th className="py-1 pr-3 font-semibold">Name</th>
                <th className="py-1 pr-3 font-semibold">Sectors</th>
                <th className="py-1 font-semibold">Active</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <input type="hidden" name="zoneId" value={z.id} />
                    <input name="zoneName" defaultValue={z.name} maxLength={60} required className="admin-input" aria-label="Zone name" />
                  </td>
                  <td className="py-2 pr-3">
                    {z.id === "other" ? (
                      <>
                        <input type="hidden" name="zoneSectors" value="" />
                        <span className="text-secondary">No sector</span>
                      </>
                    ) : (
                      <input name="zoneSectors" defaultValue={sectorsText(z.sectors)} maxLength={60} placeholder="1-8" className="admin-input" aria-label={`${z.name} sectors`} />
                    )}
                  </td>
                  <td className="py-2">
                    <input type="checkbox" name={`zoneActive:${z.id}`} defaultChecked={z.active} className="size-4" aria-label={`${z.name} active`} />
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-2 pr-3">
                  <input name="newName" maxLength={60} placeholder="New zone name" className="admin-input" aria-label="New zone name" />
                </td>
                <td className="py-2 pr-3">
                  <input name="newSectors" maxLength={60} placeholder="e.g. 3-4" className="admin-input" aria-label="New zone sectors" />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <button type="submit" className="admin-btn">
            Save zones
          </button>
        </div>
      </form>

      <form action={saveDefaultsAction} className="admin-card mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 p-5">
        <input type="hidden" name="keep" value={keep} />
        <h3 className="font-semibold text-navy">Usual capacity</h3>
        <p className="t-small text-secondary">Stops per window per zone on a normal day. Change one day on the board above.</p>
        {(["pickup", "delivery"] as const).map((kind) => (
          <div key={kind} className="overflow-x-auto">
            <table className="w-full min-w-[480px] t-small">
              <caption className="pb-1 text-left font-semibold text-navy">{kind === "pickup" ? "Pickups" : "Deliveries"}</caption>
              <thead>
                <tr className="text-left text-secondary">
                  <th className="py-1 pr-3 font-semibold">Zone</th>
                  {windows.filter((w) => w.active).map((w) => (
                    <th key={w.id} className="py-1 pr-3 font-semibold">
                      {WINDOW_NAME[w.id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.filter((z) => z.active).map((z) => (
                  <tr key={z.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold text-navy">{z.name}</td>
                    {windows.filter((w) => w.active).map((w) => (
                      <td key={w.id} className="py-2 pr-3">
                        <input
                          name={`d:${kind}:${z.id}:${w.id}`}
                          type="number"
                          min={0}
                          max={99}
                          inputMode="numeric"
                          defaultValue={dflt(kind, z.id, w.id)}
                          className="admin-input max-w-[5.5rem]"
                          aria-label={`${kind} ${z.name} ${WINDOW_NAME[w.id]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div>
          <button type="submit" className="admin-btn">
            Save usual capacity
          </button>
        </div>
      </form>
    </section>
  );
}

export default async function CapacityPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("capacity");
  const canEdit = canEditCapacity(admin.role);
  const params = await searchParams;
  const today = dhakaToday();
  const dayParam = one(params.day) ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && dayParam >= today && dayParam <= addDaysIso(today, 30) ? dayParam : today;
  const keep = new URLSearchParams({ day }).toString();
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i));
  const loaded = await getBoard(day);
  const saved = one(params.saved);
  const error = one(params.error);
  const ref = one(params.ref);

  return (
    <>
      <AdminHeader
        title="Capacity"
        intro="How many pickups and deliveries each window can take, per zone. The website and the dispatch board book from these same numbers, so a window the website shows as open always has a place held for it."
      />
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {loaded.state === "not_configured" ? <p className="mt-6 t-small text-secondary">Velto Ops is not connected on this server.</p> : null}
      {loaded.state === "ok" && loaded.preview ? <DataNotice state="preview" /> : null}
      {saved && SAVED[saved] ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
          {saved === "booked" && ref ? ` Reference ${ref}.` : ""}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {error}
        </p>
      ) : null}

      {loaded.state === "ok" ? (
        <>
          <p className="mt-6 flex flex-wrap items-center gap-2 t-small text-secondary">
            Website booking by window:
            {loaded.data.config.enabled ? <Badge tone="green">On</Badge> : <Badge tone="amber">Off (preference only)</Badge>}
            {canEdit ? (
              <a href="#settings" className="font-semibold text-action hover:text-action-hover">
                Change
              </a>
            ) : null}
          </p>

          <nav aria-label="Day" className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <Link
                key={d}
                href={`/admin/capacity?${new URLSearchParams({ day: d })}`}
                aria-current={d === day ? "date" : undefined}
                className={`shrink-0 rounded-md border px-3 py-2 text-center t-small ${d === day ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
              >
                <span className="block font-semibold">{dayLabel(d, today)}</span>
                <span className={`block t-caption ${d === day ? "text-white/80" : "text-secondary"}`}>{shortDate(d).slice(4)}</span>
              </Link>
            ))}
          </nav>

          <h2 className="sr-only">Board for {shortDate(day)}</h2>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-2">
            <KindBoard board={loaded.data} kind="pickup" keep={keep} canEdit={canEdit} />
            <KindBoard board={loaded.data} kind="delivery" keep={keep} canEdit={canEdit} />
          </div>

          <section id="book" aria-labelledby="book-title" className="admin-card mt-12 scroll-mt-24 p-5 md:p-6">
            <h2 id="book-title" className="t-h4 text-navy">
              Book a pickup for a customer
            </h2>
            <p className="mt-1 t-small text-secondary">
              For WhatsApp and phone orders. Uses the same windows as the website: a full window can&apos;t be chosen, so the customer is never promised a time the riders can&apos;t make.
            </p>
            <BookForm keep={keep} canEdit={canEdit} days={days} today={today} windows={loaded.data.windows.filter((w) => w.active)} />
          </section>

          {canEdit ? <Settings board={loaded.data} keep={keep} /> : null}
        </>
      ) : null}
    </>
  );
}
