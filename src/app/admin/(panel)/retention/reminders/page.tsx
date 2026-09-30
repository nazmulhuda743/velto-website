import { AdminHeader, Badge, DataNotice, Field, one, type SearchParams } from "@/components/admin/ui";
import { getRhythmOverview } from "@/lib/admin/rhythm";
import { requireSection } from "@/lib/admin/session";
import { renderMessage, rhythmLink, SAMPLE_LINK, smsParts, type RhythmLang } from "@/lib/rhythm";
import type { Candidate, PlaybookStats } from "@/lib/rhythm-server";
import { getSiteContent } from "@/lib/site-content";
import { SITE_URL } from "@/lib/site-url";
import { refreshRhythmAction, saveRhythmAction } from "../../../rhythm-actions";

const SEGMENTS: { id: string; label: string; plan: string }[] = [
  { id: "new", label: "New", plan: "Order updates only" },
  { id: "onetimer_warm", label: "First-timer, still warm", plan: "Step 3" },
  { id: "regular_due", label: "Regular, due now", plan: "SMS the evening before" },
  { id: "regular_on_track", label: "Regular, on track", plan: "Nothing" },
  { id: "slipping", label: "Slipping regular", plan: "Staff call task" },
  { id: "occasional", label: "Occasional", plan: "Seasonal, step 3" },
  { id: "lapsed", label: "Lapsed repeat", plan: "Step 3" },
  { id: "onetimer_gone", label: "One order, long gone", plan: "Seasonal, step 3" },
];

const SAVED: Record<string, string> = {
  regular_due: "Saved. The evening run uses this from tonight.",
  slipping: "Saved. The morning run uses this from tomorrow.",
  refresh: "Groups rebuilt from the latest Velto Ops orders.",
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const svc = (s: string | null) => (s ?? "—").replace("Wash + Iron", "Wash & Iron");

function Queue({ rows, total, holdout }: { rows: Candidate[]; total: number; holdout: number }) {
  return (
    <div className="mt-4">
      <p className="t-small text-body">
        <span className="font-semibold text-navy">{total}</span> would be included today
        {holdout ? <> ({holdout} in the hold-out group, who get nothing so we can measure the difference)</> : null}.
      </p>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line">
          {rows.map((r) => (
            <li key={r.customer_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 t-small">
              <span className="min-w-24 font-semibold text-navy">{r.first_name ?? "Customer"}</span>
              <span className="text-secondary">{svc(r.usual_service)}</span>
              <span className="text-secondary">usually every {r.cadence_days ?? "?"} days</span>
              <span className="text-secondary">{r.days_since} days since the last order</span>
              {r.holdout ? <Badge>Hold-out</Badge> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Results({ s }: { s?: PlaybookStats }) {
  if (!s || (!s.contacted && !s.holdout)) return <p className="mt-3 t-small text-secondary">No results yet: nothing has run in the last 30 days.</p>;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { l: "Contacted", v: String(s.contacted), sub: s.failed ? `${s.failed} failed` : undefined },
        { l: "Opened the link", v: String(s.clicked), sub: pct(s.clicked, s.contacted) },
        { l: "Ordered within 7 days", v: pct(s.orderedContacted, s.contacted), sub: `${s.orderedContacted} of ${s.contacted}` },
        { l: "Hold-out ordered", v: pct(s.orderedHoldout, s.holdout), sub: `${s.orderedHoldout} of ${s.holdout} who got nothing` },
      ].map((x) => (
        <div key={x.l} className="rounded-md border border-line p-3">
          <dt className="t-caption text-secondary">{x.l}</dt>
          <dd className="mt-0.5 text-[20px] font-semibold tabular-nums text-navy">{x.v}</dd>
          {x.sub ? <dd className="t-caption text-secondary">{x.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function Example({ template, lang, name, service }: { template: string; lang: RhythmLang; name: string; service: string | null }) {
  const text = renderMessage(template, { firstName: name, service, link: SAMPLE_LINK }, lang);
  const parts = smsParts(text);
  return (
    <div className="mt-2 rounded-md bg-soft p-3">
      <p lang={lang} className="t-small text-navy">
        {text}
      </p>
      <p className="mt-1 t-caption text-secondary">
        {parts.length} characters · {parts.parts} SMS part{parts.parts === 1 ? "" : "s"}
        {parts.unicode ? " (Bangla: 70 characters per part, 67 when split)" : ""}
      </p>
    </div>
  );
}

export default async function RemindersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("retention");
  const params = await searchParams;
  const saved = one(params.saved);
  const error = one(params.error);
  const errorAt = one(params.playbook);
  const [{ rhythm }, overview] = await Promise.all([getSiteContent(), getRhythmOverview()]);
  const canEdit = admin.role === "owner" || admin.role === "manager";
  const due = rhythm.regularDue;
  const data = overview.state === "ok" ? overview.data : null;
  const sample = data?.queue.regular_due.rows.find((r) => !r.holdout);
  const inline = (id: string) =>
    error && errorAt === id ? (
      <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
        {error}
      </p>
    ) : saved === id ? (
      <p role="status" className="mt-4 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
        {SAVED[id]}
      </p>
    ) : null;

  return (
    <>
      <AdminHeader
        title="Reminders"
        intro="Every morning each customer is placed in a group from their own Velto Ops orders. Switched-on playbooks then remind the right people: an SMS the evening before a regular's usual day, or a call task for a regular who has gone quiet. The rules (at most one reminder a week, none while an order is open, none after “stop”) are enforced by the database."
        actions={
          <a href="/r/preview0" target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
            See the customer’s page ↗
          </a>
        }
      />
      {error && !errorAt ? (
        <p role="alert" className="mt-6 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {error}
        </p>
      ) : saved === "refresh" ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED.refresh}
        </p>
      ) : null}
      {overview.state !== "ok" ? <DataNotice state={overview.state} message={overview.state === "error" ? overview.message : undefined} /> : overview.preview ? <DataNotice state="preview" /> : null}

      {data ? (
        <section aria-labelledby="groups-title" className="admin-card mt-6 p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="groups-title" className="t-h4 text-navy">
              Customer groups today
            </h2>
            <form action={refreshRhythmAction}>
              <button type="submit" className="admin-btn-secondary">
                Rebuild now
              </button>
            </form>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {SEGMENTS.map((s) => (
              <li key={s.id} className="rounded-md border border-line p-3">
                <p className="text-[22px] font-semibold tabular-nums text-navy">{data.stats.segments[s.id] ?? 0}</p>
                <p className="t-small font-semibold text-navy">{s.label}</p>
                <p className="t-caption text-secondary">{s.plan}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 t-caption text-secondary">
            {data.stats.computedAt ? `Rebuilt ${new Date(data.stats.computedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}.` : null}{" "}
            {data.stats.optouts ? `${data.stats.optouts} number${data.stats.optouts === 1 ? "" : "s"} asked for no reminders.` : null}
          </p>
        </section>
      ) : null}

      <section id="regular_due" aria-labelledby="due-title" className="admin-card mt-6 scroll-mt-6 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="due-title" className="t-h4 text-navy">
            Regular, due now · SMS
          </h2>
          <Badge tone={due.enabled ? "green" : "neutral"}>{due.enabled ? "On · every evening 6:25 pm" : "Off"}</Badge>
        </div>
        <p className="mt-1 t-small text-secondary">
          Customers with 3+ orders whose usual gap is up. One SMS the evening before, with a link that books the same service in one tap
          (or replies on WhatsApp). Not sent to anyone with an open order, anyone reminded in the last 7 days, or anyone who said stop.
        </p>
        {inline("regular_due")}
        {data ? <Queue {...data.queue.regular_due} /> : null}
        <form action={saveRhythmAction} className="mt-5 space-y-4">
          <input type="hidden" name="playbook" value="regular_due" />
          <fieldset disabled={!canEdit} className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="enabled" defaultChecked={due.enabled} className="size-4" />
              <span className="font-semibold text-navy">Send these SMS every evening</span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Message in Bangla" hint="{hi} = the first name and a comma (or nothing), {service} = their usual service, {link} = the one-tap link (required).">
                <textarea name="textBn" lang="bn" rows={3} maxLength={400} defaultValue={due.textBn} className="admin-input" />
              </Field>
              <Field label="Message in English" hint="Same placeholders. {hi} becomes “Hi Nazmul, ” or “Hi, ”.">
                <textarea name="textEn" rows={3} maxLength={400} defaultValue={due.textEn} className="admin-input" />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="t-small font-semibold text-navy">How it reads (Bangla)</p>
                <Example template={due.textBn} lang="bn" name={sample?.first_name ?? "Nazmul"} service={sample?.usual_service ?? "Ironing"} />
              </div>
              <div>
                <p className="t-small font-semibold text-navy">How it reads (English)</p>
                <Example template={due.textEn} lang="en" name={sample?.first_name ?? "Nazmul"} service={sample?.usual_service ?? "Ironing"} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Language sent" hint="Bangla by default.">
                <select name="lang" defaultValue={due.lang} className="admin-input">
                  <option value="bn">Bangla</option>
                  <option value="en">English</option>
                </select>
              </Field>
              <Field label="Most SMS per evening" hint="Customers who have spent the most go first; the rest go the next evening.">
                <input name="max" type="number" min={1} max={150} defaultValue={due.maxPerRun} className="admin-input" />
              </Field>
            </div>
            <p className="t-caption text-secondary">Links look like {rhythmLink(SITE_URL, "Ab3xK9pQ", due.lang)} and expire after 7 days.</p>
            <button type="submit" className="admin-btn">
              Save
            </button>
          </fieldset>
          {!canEdit ? <p className="t-small text-secondary">Only an Owner or a Manager can change reminders.</p> : null}
        </form>
        <h3 className="mt-6 t-small font-semibold text-navy">Last 30 days</h3>
        <Results s={data?.stats.playbooks.regular_due} />
      </section>

      <section id="slipping" aria-labelledby="slip-title" className="admin-card mt-6 scroll-mt-6 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="slip-title" className="t-h4 text-navy">
            Slipping regulars · staff call
          </h2>
          <Badge tone={rhythm.slipping.enabled ? "green" : "neutral"}>{rhythm.slipping.enabled ? "On · every morning 10:30" : "Off"}</Badge>
        </div>
        <p className="mt-1 t-small text-secondary">
          Regulars who are now more than twice their usual gap. Each morning a “Call” task appears on the Ops task board, due by 6 pm, with
          what they usually order and how long it has been. A person asks how the last order was; no discount on the first contact.
        </p>
        {inline("slipping")}
        {data ? <Queue {...data.queue.slipping} /> : null}
        <form action={saveRhythmAction} className="mt-5">
          <input type="hidden" name="playbook" value="slipping" />
          <fieldset disabled={!canEdit} className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="enabled" defaultChecked={rhythm.slipping.enabled} className="size-4" />
              <span className="font-semibold text-navy">Make call tasks every morning</span>
            </label>
            <Field label="Most tasks per day" hint="Keep it to what one person can call in a day. Highest spenders first.">
              <input name="max" type="number" min={1} max={40} defaultValue={rhythm.slipping.maxPerDay} className="admin-input max-w-40" />
            </Field>
            <button type="submit" className="admin-btn">
              Save
            </button>
          </fieldset>
        </form>
        <h3 className="mt-6 t-small font-semibold text-navy">Last 30 days</h3>
        <Results s={data?.stats.playbooks.slipping} />
      </section>
    </>
  );
}
