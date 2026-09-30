import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { addDays, dayName, dhakaToday } from "@/lib/admin/dispatch-logic";
import { requireSection } from "@/lib/admin/session";
import { getRiderSettings, todayError, TODAY_ERRORS, type RiderSetting, type TodayError } from "@/lib/admin/today";
import { dayOffAction, riderSettingsAction } from "../../today-actions";

export const metadata = { title: "Riders & windows · Velto Command Center" };

const SAVED: Record<string, string> = {
  rider_saved: "Saved. Today and the dispatch board use the new settings straight away.",
  day_off: "Marked off for that day. They are not offered for stops that day.",
  day_on: "Back on for that day.",
};

const ROLE_NAME: Record<string, string> = { admin: "Admin", manager: "Manager", rider: "Rider", worker: "Worker" };
const RETURN = "/admin/riders";

/** One "Off today" / "Off tomorrow" switch: a plain form that flips the day. */
function DayOff({ person, day, label, off }: { person: RiderSetting; day: string; label: string; off: boolean }) {
  return (
    <form action={dayOffAction} className="min-w-0">
      <input type="hidden" name="return" value={RETURN} />
      <input type="hidden" name="profile" value={person.id} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="off" value={off ? "0" : "1"} />
      <button
        type="submit"
        aria-pressed={off}
        aria-label={off ? `${person.name} is ${label.toLowerCase()} (${dayName(day)}). Press to put back on.` : `Mark ${person.name} ${label.toLowerCase()} (${dayName(day)})`}
        className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg border px-3 py-1 text-center t-small font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${
          off ? "border-[#8a5300]/40 bg-[#fff4e5] text-[#8a5300]" : "border-line-strong bg-white text-navy hover:border-navy"
        }`}
      >
        {label}
        {off ? <span className="t-caption font-normal">Tap to undo</span> : null}
      </button>
    </form>
  );
}

function PersonRow({ person, today, tomorrow }: { person: RiderSetting; today: string; tomorrow: string }) {
  const formId = `rider-${person.id}`;
  return (
    <li className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center lg:gap-6">
      <div className="min-w-0">
        <p className="truncate font-semibold text-navy">{person.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 t-caption text-secondary">
          <span>{ROLE_NAME[person.role] ?? person.role}</span>
          {person.offToday ? <Badge tone="amber">Off today</Badge> : null}
          {person.offTomorrow ? <Badge tone="amber">Off tomorrow</Badge> : null}
        </p>
      </div>

      <form id={formId} action={riderSettingsAction} className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] lg:w-[30rem]">
        <input type="hidden" name="return" value={RETURN} />
        <input type="hidden" name="profile" value={person.id} />
        <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line bg-soft px-3 t-small font-semibold text-navy sm:col-span-1">
          <input type="checkbox" name="can_ride" value="1" defaultChecked={person.canRide} className="size-5 shrink-0 accent-[var(--color-brand-action)]" />
          Can do pickups &amp; deliveries
        </label>
        <label className="block t-caption font-semibold text-secondary">
          Stops per time window
          <input name="stops" type="number" min={1} max={30} step={1} inputMode="numeric" required defaultValue={person.stopsPerWindow} className="admin-input mt-1" />
        </label>
        <button type="submit" className="admin-btn col-span-2 sm:col-span-1">
          Save
        </button>
      </form>

      <div className="grid grid-cols-2 gap-2 lg:w-[22rem]">
        <DayOff person={person} day={today} label="Off today" off={person.offToday} />
        <DayOff person={person} day={tomorrow} label="Off tomorrow" off={person.offTomorrow} />
      </div>
    </li>
  );
}

export default async function RidersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("riders");
  const params = await searchParams;
  const done = one(params.done);
  const errorCode = one(params.error);
  const error = errorCode && errorCode in TODAY_ERRORS ? todayError(errorCode as TodayError, "en") : null;
  const loaded = await getRiderSettings();
  const today = dhakaToday();
  const tomorrow = addDays(today, 1);

  return (
    <>
      <AdminHeader
        title="Riders & windows"
        intro="Who can take pickups and deliveries, and how many stops each person takes in one time window. Until you tick anyone, everyone on the staff list is offered at 8 stops."
      />
      {error ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {error}
        </p>
      ) : done && SAVED[done] ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[done]}
        </p>
      ) : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {loaded.state === "not_configured" ? <DataNotice state="error" message="Velto Ops is not connected on this server, so there is no staff list to show." /> : null}
      {loaded.state === "ok" && loaded.preview ? <DataNotice state="preview" /> : null}
      {loaded.state === "ok" && !loaded.data.installed ? <DataNotice state="error" message={TODAY_ERRORS.not_installed} /> : null}

      {loaded.state === "ok" ? (
        <section aria-labelledby="staff-title" className="mt-6">
          <h2 id="staff-title" className="sr-only">
            Staff
          </h2>
          {loaded.data.people.length ? (
            <div className="admin-card px-4 md:px-5">
              <ul className="divide-y divide-line">
                {loaded.data.people.map((p) => (
                  <PersonRow key={p.id} person={p} today={today} tomorrow={tomorrow} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="t-small text-secondary">No active staff found in Velto Ops.</p>
          )}
          <p className="mt-3 t-caption text-secondary">
            {loaded.data.anyTicked ? "Only people ticked here are offered for stops." : "Nobody is ticked yet, so everyone above is offered at 8 stops."} Off today and Off tomorrow hide a person from that day only.
          </p>
        </section>
      ) : null}
    </>
  );
}
