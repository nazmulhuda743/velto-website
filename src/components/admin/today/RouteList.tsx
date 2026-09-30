import { markDoneAction, pickOrderAction } from "@/app/admin/today-actions";
import type { TodayText } from "@/content/i18n/admin-today";
import { DEFAULT_CAPACITY, SLOTS, sortTrips, stopCount, type DispatchJob, type SlotId } from "@/lib/admin/dispatch-logic";
import { riderLoad, type OrderCandidate, type Rider } from "@/lib/admin/today-logic";
import { initials, place, whenText } from "./format";
import { Icon } from "./icons";

const label = (j: DispatchJob) => `${j.kind === "delivery" ? `Delivery ${j.order_number ?? ""}` : "Pickup"} – ${j.customer_name ?? "customer"}`;
const arrow = (j: DispatchJob) => (j.kind === "delivery" ? "↓" : "↑");

/** One rider in one window: avatar, stops (↑ pickup / ↓ delivery), load dots and "3/8"; opens to the stops. */
function RiderLane({ name, stops, load, capacity, view, t }: { name: string; stops: DispatchJob[]; load: number; capacity: number; view: string; t: TodayText }) {
  const dots = Math.min(12, Math.max(capacity, stops.length));
  return (
    <li className="border-b border-line">
      <details className="group">
        <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-2.5 rounded-[8px] py-2.5 hover:bg-soft/70 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="grid size-[34px] shrink-0 place-items-center rounded-full bg-navy text-[14px] font-semibold text-white">
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-navy">{name}</span>
            <span className="block truncate text-[14px] text-secondary">{stops.map((j) => `${arrow(j)} ${j.customer_name ?? j.order_number ?? ""}`).join(" · ")}</span>
            <span aria-hidden="true" className="mt-1.5 flex gap-[3px]">
              {Array.from({ length: dots }, (_, i) => (
                <i key={i} className={`h-1.5 w-3.5 rounded-full ${i < stops.length ? (stops[i].kind === "delivery" ? "bg-purple" : "bg-action") : "bg-line"}`} />
              ))}
            </span>
          </span>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-navy">
            {t.num(load)}/{t.num(capacity)}
          </span>
          <Icon name="down" className="size-4 text-secondary transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mb-2 ml-[44px] space-y-1">
          {stops.map((j) => (
            <li key={j.id} className="rounded-[10px] bg-soft px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[15px] text-navy">
                  <span className="font-semibold">
                    {arrow(j)} {j.customer_name ?? ""}
                  </span>
                  <span className="block t-small text-secondary [overflow-wrap:anywhere]">
                    {[j.kind === "delivery" ? t.delivery : t.pickup, j.order_number, place(j.area, t), j.address].filter(Boolean).join(" · ")}
                  </span>
                </p>
                {j.phone ? (
                  <a href={`tel:${j.phone.replace(/[^\d+]/g, "")}`} aria-label={`${t.call} ${j.customer_name ?? ""}`} className="grid size-11 shrink-0 place-items-center rounded-full text-navy hover:bg-white">
                    <Icon name="phone" />
                  </a>
                ) : null}
              </div>
              <details className="group/more">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 t-small font-semibold text-secondary hover:text-navy [&::-webkit-details-marker]:hidden">
                  {t.more}
                  <Icon name="down" className="size-3.5 transition-transform group-open/more:rotate-180" />
                </summary>
                <form action={markDoneAction} className="pb-1">
                  <input type="hidden" name="job" value={j.id} />
                  <input type="hidden" name="kind" value={j.kind} />
                  <input type="hidden" name="label" value={label(j)} />
                  <input type="hidden" name="tab" value="route" />
                  <input type="hidden" name="view" value={view} />
                  <button type="submit" className="admin-btn-secondary">
                    <Icon name="check" />
                    {j.kind === "delivery" ? t.delivered : t.pickedUp}
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

/** "Which order?": a picked-up pickup that could be one of several Ops orders; one tap links it. */
function WhichOrder({ job, candidates, today, view, t }: { job: DispatchJob; candidates: OrderCandidate[]; today: string; view: string; t: TodayText }) {
  return (
    <li className="rounded-[14px] border-[1.5px] border-navy p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-[18px] font-semibold text-navy [overflow-wrap:anywhere]">{job.customer_name ?? job.phone ?? ""}</h3>
        {job.picked_at ? <span className="shrink-0 rounded-full bg-soft px-2.5 py-0.5 text-[13px] font-semibold text-navy">{t.pickedAt(whenText(job.picked_at, today, t))}</span> : null}
      </div>
      <p className="mt-1 t-small text-secondary">{[place(job.area, t), job.assignee_name].filter(Boolean).join(" · ")}</p>
      <h4 className="mt-2 text-[15px] font-semibold text-navy">{t.whichOrder}</h4>
      <p className="t-small text-secondary">{t.whichOrderHint}</p>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {candidates.map((o) => (
          <li key={o.orderNumber}>
            <form action={pickOrderAction}>
              <input type="hidden" name="job" value={job.id} />
              <input type="hidden" name="order" value={o.orderNumber} />
              <input type="hidden" name="label" value={label(job)} />
              <input type="hidden" name="tab" value="route" />
              <input type="hidden" name="view" value={view} />
              <button type="submit" className="flex min-h-12 flex-col items-start justify-center rounded-[12px] border border-line-strong bg-white px-4 py-1.5 text-left hover:border-navy">
                <span className="text-[15px] font-semibold tabular-nums text-navy">{o.orderNumber}</span>
                <span className="t-caption text-secondary">{whenText(o.createdAt, today, t)}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Route: per window, the riders with stops, then "Free: …" for riders without any. Jobs whose rider
 * is now off (or no longer a rider) still show under that rider's name. Picked-up pickups that could
 * be several Ops orders come first ("Which order?").
 */
export function RouteList({
  jobs,
  riders,
  date,
  today,
  view,
  which,
  t,
}: {
  jobs: DispatchJob[];
  riders: Rider[];
  date: string;
  today: string;
  view: string;
  which: { job: DispatchJob; candidates: OrderCandidate[] }[];
  t: TodayText;
}) {
  const riderById = new Map(riders.map((r) => [r.id, r]));
  const lanes = SLOTS.map((s) => {
    const slot: SlotId = s.id;
    const stops = jobs.filter((j) => j.stage === "scheduled" && j.slot_date === date && j.slot === slot && j.assignee_id);
    const ids = [...new Set(stops.map((j) => j.assignee_id!))];
    const order = (id: string) => {
      const i = riders.findIndex((r) => r.id === id);
      return i < 0 ? riders.length : i;
    };
    ids.sort((a, b) => order(a) - order(b));
    const busy = ids.map((id) => {
      const mine = sortTrips(stops.filter((j) => j.assignee_id === id));
      const rider = riderById.get(id);
      return { id, name: rider?.name ?? mine[0].assignee_name ?? "", stops: mine, load: riderLoad(jobs, id, date, slot), capacity: rider?.stopsPerWindow || DEFAULT_CAPACITY };
    });
    const free = riders.filter((r) => !r.off && !ids.includes(r.id)).map((r) => r.name);
    return { slot, total: stopCount(stops), busy, free };
  });
  const off = riders.filter((r) => r.off).map((r) => r.name);
  const any = lanes.some((l) => l.busy.length);

  return (
    <div>
      {which.length ? (
        <section aria-label={t.whichOrder} className="mb-5">
          <ul className="space-y-3">
            {which.map((w) => (
              <WhichOrder key={w.job.id} job={w.job} candidates={w.candidates} today={today} view={view} t={t} />
            ))}
          </ul>
        </section>
      ) : null}
      {!any ? <p className="mb-2 rounded-[12px] bg-soft px-4 py-3 t-small text-secondary">{t.noStops}</p> : null}
      {lanes.map((l) => (
        <section key={l.slot} aria-labelledby={`lane-${l.slot}`} className="mt-4 first:mt-0">
          <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
            <h2 id={`lane-${l.slot}`} className="text-[17px] font-semibold text-navy">
              {t.windowName[l.slot]} <span className="text-[14px] font-normal text-secondary">{t.windowHours[l.slot]}</span>
            </h2>
            <span className="t-small tabular-nums text-secondary">{t.stops(l.total)}</span>
          </div>
          {l.busy.length ? (
            <ul>
              {l.busy.map((b) => (
                <RiderLane key={b.id} name={b.name} stops={b.stops} load={b.load} capacity={b.capacity} view={view} t={t} />
              ))}
            </ul>
          ) : null}
          {l.free.length ? (
            <p className="mt-2 t-small text-secondary">
              {t.free}: {l.free.join(", ")}
            </p>
          ) : null}
        </section>
      ))}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 t-small text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-action" />↑ {t.pickup}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="h-1.5 w-3.5 rounded-full bg-purple" />↓ {t.delivery}
        </span>
        {off.length ? (
          <span>
            {date === today ? t.offToday : t.offDay}: {off.join(", ")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
