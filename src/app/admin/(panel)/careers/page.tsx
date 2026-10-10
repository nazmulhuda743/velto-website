import { AdminHeader, Badge, Field, Notice, one, type SearchParams } from "@/components/admin/ui";
import { displayNumber, applyNumber, MAX_LIST_ITEMS, type JobPost } from "@/lib/careers";
import { requireSection } from "@/lib/admin/session";
import { getSiteContent } from "@/lib/site-content";
import { saveCareersSettingsAction, saveJobAction } from "../../careers-actions";

const TYPE_LABEL: Record<JobPost["type"], string> = { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract" };

/** English and Bangla side by side; Bangla left empty shows the English on /bn pages. */
function Pair({ name, label, job, hint, rows, max }: { name: keyof JobPost; label: string; job?: JobPost; hint?: string; rows?: number; max: number }) {
  const en = job?.[name];
  const bn = job?.[`${name}Bn` as keyof JobPost];
  const value = (v: unknown) => (Array.isArray(v) ? v.join("\n") : typeof v === "string" ? v : "");
  const control = (field: string, v: unknown, lang: "English" | "Bangla") =>
    rows ? (
      <textarea name={field} defaultValue={value(v)} rows={rows} maxLength={rows > 3 ? 4000 : max} className="admin-input" aria-label={`${label} (${lang})`} />
    ) : (
      <input name={field} defaultValue={value(v)} maxLength={max} className="admin-input" aria-label={`${label} (${lang})`} required={name === "title" && lang === "English"} />
    );
  return (
    <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
      <Field label={`${label} (English)`} hint={hint}>
        {control(name, en, "English")}
      </Field>
      <Field label={`${label} (Bangla)`} hint="Optional. Empty shows the English on Bangla pages.">
        {control(`${name}Bn`, bn, "Bangla")}
      </Field>
    </div>
  );
}

function JobFields({ job }: { job?: JobPost }) {
  const listHint = `One per line, up to ${MAX_LIST_ITEMS}.`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Pair name="title" label="Role title" job={job} max={100} hint="As candidates would search for it, e.g. Ironing Specialist." />
      <Field label="Type">
        <select name="type" defaultValue={job?.type ?? "full-time"} className="admin-input">
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-3 self-end pb-3">
        <input type="checkbox" name="open" defaultChecked={job ? job.open : true} className="size-4" />
        <span className="font-semibold text-navy">Open: show on the website</span>
      </label>
      <Pair name="location" label="Where" job={job} max={120} hint="e.g. Sector 9 hub, Uttara" />
      <Pair name="schedule" label="Days and hours" job={job} max={160} hint="e.g. 6 days a week, 10 AM to 8 PM" />
      <Pair name="salary" label="Salary" job={job} max={80} hint="Optional. Leave empty to discuss it in the interview." />
      <Pair name="summary" label="Short summary" job={job} max={600} rows={3} hint="Two sentences: what the role is and who it suits." />
      <Pair name="duties" label="What you'll do" job={job} max={4000} rows={5} hint={listHint} />
      <Pair name="requirements" label="What we look for" job={job} max={4000} rows={5} hint={listHint} />
      <Pair name="offer" label="What we offer" job={job} max={4000} rows={4} hint={`${listHint} Only what Velto actually provides.`} />
    </div>
  );
}

export default async function CareersAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("careers");
  const params = await searchParams;
  const { careers, settings } = await getSiteContent();
  const number = applyNumber(careers, settings.whatsappNumber);
  const openCount = careers.jobs.filter((j) => j.open).length;

  return (
    <>
      <AdminHeader
        title="Careers & jobs"
        intro={
          <>
            Roles posted here appear on <a href="/careers" target="_blank" rel="noopener" className="font-semibold text-action underline">velto.com.bd/careers</a>, in
            English and Bangla. Candidates apply on WhatsApp. {openCount ? `${openCount} open now.` : "No roles are open right now."}
          </>
        }
      />
      <Notice saved={one(params.saved)} error={one(params.error)} />

      <section className="admin-card mt-6 p-5">
        <h2 className="font-semibold text-navy">Where applications go</h2>
        <p className="mt-1 t-small text-secondary">
          Applications currently go to <strong className="tabular-nums">{displayNumber(number)}</strong>
          {careers.whatsappNumber ? " (careers number)." : " (the main customer WhatsApp). A separate careers number keeps job messages out of order intake."}
        </p>
        <form action={saveCareersSettingsAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Careers WhatsApp number" hint="Optional. 01XXXXXXXXX. Empty uses the main WhatsApp number.">
            <input name="whatsappNumber" defaultValue={careers.whatsappNumber} maxLength={20} inputMode="tel" className="admin-input" placeholder="01XXXXXXXXX" />
          </Field>
          <Field label="Team page on Facebook" hint="Optional. The Life at Velto page link, starting with https://">
            <input name="facebookUrl" defaultValue={careers.facebookUrl} maxLength={300} className="admin-input" placeholder="https://www.facebook.com/…" />
          </Field>
          <div className="md:col-span-2">
            <button type="submit" className="admin-btn">
              Save settings
            </button>
          </div>
        </form>
      </section>

      <details className="admin-card mt-4">
        <summary className="cursor-pointer px-5 py-4 font-semibold text-navy">+ Post a new role</summary>
        <form action={saveJobAction} className="border-t border-line p-5">
          <input type="hidden" name="op" value="add" />
          <JobFields />
          <button type="submit" className="admin-btn mt-5">
            Post role
          </button>
        </form>
      </details>

      {careers.jobs.length === 0 ? (
        <p className="mt-6 t-small text-secondary">No roles yet. The careers page says there are no openings and links to the team page.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {careers.jobs.map((job, i) => (
            <li key={job.id} className="admin-card">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4">
                  <span className="font-semibold text-navy">{job.title}</span>
                  <span className="t-small text-secondary">
                    {TYPE_LABEL[job.type]}
                    {job.location ? ` · ${job.location}` : ""}
                    {job.postedAt ? ` · posted ${job.postedAt}` : ""}
                  </span>
                  {job.open ? <Badge tone="green">Open</Badge> : <Badge>Closed</Badge>}
                  {job.titleBn ? null : <Badge tone="amber">No Bangla title</Badge>}
                </summary>
                <form action={saveJobAction} className="border-t border-line p-5">
                  <input type="hidden" name="id" value={job.id} />
                  <JobFields job={job} />
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="submit" name="op" value="save" className="admin-btn">
                      Save
                    </button>
                    <button type="submit" name="op" value="toggle" className="admin-btn-secondary" formNoValidate>
                      {job.open ? "Close role" : "Reopen role"}
                    </button>
                    <button type="submit" name="op" value="up" disabled={i === 0} className="admin-btn-secondary" formNoValidate>
                      Move up
                    </button>
                    <button type="submit" name="op" value="down" disabled={i === careers.jobs.length - 1} className="admin-btn-secondary" formNoValidate>
                      Move down
                    </button>
                    <button type="submit" name="op" value="delete" className="admin-btn-danger ml-auto" formNoValidate>
                      Delete
                    </button>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
