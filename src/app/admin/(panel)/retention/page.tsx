import { AdminHeader, Badge, DataNotice, Notice, one, type SearchParams } from "@/components/admin/ui";
import { BUCKETS, getRetentionQueue, getRetentionSummary, type RetentionRow } from "@/lib/admin/retention";
import { retentionMessage, whatsappLink, type MessageLang, type RetentionBucket } from "@/lib/admin/retention-messages";
import { displayBdPhone } from "@/lib/customer/validation";
import { logRetentionAction } from "../../actions";

const BUCKET_COPY: Record<RetentionBucket, { tab: string; title: string; why: string }> = {
  second: {
    tab: "Second order",
    title: "One order so far",
    why: "Ordered once, 7–60 days ago. Fewer than half of first-time customers ever order again, so this list matters most. Ask how the first order went.",
  },
  due: {
    tab: "Due now",
    title: "Due at their usual pace",
    why: "Two or more orders and now at or past their own usual gap. A short nudge at the right time keeps the routine going.",
  },
  winback: {
    tab: "Win back",
    title: "Haven't ordered in 2–6 months",
    why: "Ask if anything went wrong, and listen. Most valuable customers are first.",
  },
};

const SAVED: Record<string, string> = {
  messaged: "Marked as messaged. They'll be off the list for 7 days, or until they order.",
  not_now: "Marked as not now. They'll be off the list for 14 days.",
  wrong_number: "Marked as wrong number. They won't appear again; update the number in Velto Ops.",
  opt_out: "Done. They won't be listed for messages again.",
};

const DAILY = 20;

const dateLabel = (iso: string | null) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T00:00:00+06:00` : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" })
    : null;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const services = (s: string[]) => s.map((x) => x.replace("Wash + Iron", "Wash & Iron")).join(", ");

function Row({ r, bucket, lang }: { r: RetentionRow; bucket: RetentionBucket; lang: MessageLang }) {
  const message = retentionMessage(bucket, r, lang);
  const wa = whatsappLink(r.phone, message);
  const facts = [
    `${r.orders} order${r.orders === 1 ? "" : "s"}`,
    `last ${dateLabel(r.lastOrder)} (${r.daysSince} day${r.daysSince === 1 ? "" : "s"} ago)`,
    services(r.lastServices) || null,
    r.lastOrderNumber,
  ].filter(Boolean);
  return (
    <li className="admin-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {r.name || "Unnamed customer"}
            {r.zone ? <span className="font-normal text-secondary"> · {r.zone}</span> : null}
          </p>
          <p className="t-small text-secondary">{facts.join(" · ")}</p>
          {bucket !== "second" && r.everyDays ? (
            <p className="t-small text-body">
              Usually every ~{r.everyDays} days{r.dueOn ? ` · was due ${dateLabel(r.dueOn)}` : ""}
            </p>
          ) : null}
          {r.lastContact ? (
            <p className="mt-1 t-caption text-secondary">
              Last contact {dateLabel(r.lastContact.at)} by {r.lastContact.staff}: {r.lastContact.outcome.replace("_", " ")}
            </p>
          ) : null}
        </div>
        <p className="t-small font-semibold text-navy tabular-nums">{r.phone ? displayBdPhone(r.phone) : "No number"}</p>
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer t-small font-semibold text-blue">See the message</summary>
        <p className="mt-2 rounded-md bg-soft p-3 t-small text-body" lang={lang}>
          {message}
        </p>
      </details>

      <form action={logRetentionAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="customerId" value={r.customerId} />
        <input type="hidden" name="bucket" value={bucket} />
        <input type="hidden" name="lang" value={lang} />
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="admin-btn">
            1. Open WhatsApp
          </a>
        ) : (
          <Badge tone="amber">No valid mobile number</Badge>
        )}
        <button type="submit" name="outcome" value="messaged" className="admin-btn-secondary">
          2. Mark messaged
        </button>
        <span className="mx-1 hidden h-5 w-px bg-line sm:inline-block" aria-hidden="true" />
        <button type="submit" name="outcome" value="not_now" className="admin-btn-secondary">
          Not now
        </button>
        <button type="submit" name="outcome" value="wrong_number" className="admin-btn-secondary">
          Wrong number
        </button>
        <button type="submit" name="outcome" value="opt_out" className="admin-btn-danger">
          Don&apos;t contact
        </button>
      </form>
    </li>
  );
}

export default async function RetentionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const bucketParam = one(params.bucket);
  const bucket: RetentionBucket = BUCKETS.includes(bucketParam as RetentionBucket) ? (bucketParam as RetentionBucket) : "second";
  const lang: MessageLang = one(params.lang) === "en" ? "en" : "bn";
  const all = one(params.all) === "1";
  const [summary, queue] = await Promise.all([getRetentionSummary(), getRetentionQueue(bucket, all ? 200 : DAILY)]);
  const s = summary.state === "ok" ? summary.data : null;
  const saved = one(params.saved);
  const href = (p: Record<string, string>) => `/admin/retention?${new URLSearchParams({ bucket, lang, ...p })}`;

  return (
    <>
      <AdminHeader
        title="Bring customers back"
        intro="Who to message today so a first order becomes a second, and a second becomes a routine. The lists come from Velto Ops orders; nobody is listed while an order is in progress, and nobody is asked twice in a week."
      />
      {summary.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {summary.state === "error" ? <DataNotice state="error" message={summary.message} /> : null}
      <Notice error={one(params.error)} />
      {saved && SAVED[saved] && !one(params.error) ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
        </p>
      ) : null}

      {s ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Came back after a message", value: `${s.cameBack30d} of ${s.messaged30d}`, sub: "ordered within 14 days · last 30 days" },
            { label: "Messaged this week", value: String(s.messaged7d), sub: `aim for ${DAILY} a day` },
            { label: "Order again after the first", value: pct(s.withSecond, s.customers), sub: `${s.withSecond} of ${s.customers} customers` },
            { label: "Third order after a second", value: pct(s.withThird, s.withSecond), sub: s.medianEveryDays ? `typical gap ${Math.round(s.medianEveryDays)} days` : undefined },
          ].map((t) => (
            <div key={t.label} className="admin-card p-4">
              <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{t.label}</dt>
              <dd className="mt-1 text-[24px] font-semibold leading-tight text-navy tabular-nums">{t.value}</dd>
              {t.sub ? <dd className="t-caption text-secondary">{t.sub}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}

      <nav aria-label="Lists" className="mt-8 flex flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <a
            key={b}
            href={`/admin/retention?${new URLSearchParams({ bucket: b, lang })}`}
            aria-current={bucket === b ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 font-semibold ${bucket === b ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {BUCKET_COPY[b].tab}
            {s ? <span className={`rounded-full px-2 text-[12px] leading-5 tabular-nums ${bucket === b ? "bg-white/20" : "bg-soft"}`}>{s.queue[b]}</span> : null}
          </a>
        ))}
      </nav>

      <section aria-labelledby="list-title" className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="list-title" className="text-[20px] font-semibold text-navy">
              {BUCKET_COPY[bucket].title}
            </h2>
            <p className="mt-1 max-w-[70ch] t-small text-secondary">{BUCKET_COPY[bucket].why}</p>
          </div>
          <div className="inline-flex rounded-md border border-line bg-white p-0.5" role="group" aria-label="Message language">
            {(["bn", "en"] as const).map((l) => (
              <a
                key={l}
                href={href({ lang: l, ...(all ? { all: "1" } : {}) })}
                aria-current={lang === l ? "true" : undefined}
                className={`rounded-[6px] px-3 py-1.5 t-small font-semibold ${lang === l ? "bg-navy text-white" : "text-navy hover:bg-soft"}`}
              >
                {l === "bn" ? "বাংলা" : "English"}
              </a>
            ))}
          </div>
        </div>

        {queue.state === "error" && summary.state !== "error" ? <DataNotice state="error" message={queue.message} /> : null}
        {queue.state === "ok" ? (
          queue.data.length ? (
            <>
              <p className="mt-4 t-small text-secondary">
                {all ? `Showing ${queue.data.length}.` : `Today's ${Math.min(DAILY, queue.data.length)}, best first.`} Open WhatsApp, send, then mark it.
              </p>
              <ul className="mt-3 space-y-3">
                {queue.data.map((r) => (
                  <Row key={r.customerId} r={r} bucket={bucket} lang={lang} />
                ))}
              </ul>
              {!all && s && s.queue[bucket] > queue.data.length ? (
                <a href={href({ all: "1" })} className="mt-4 inline-block t-small font-semibold text-navy underline underline-offset-4">
                  Show all {s.queue[bucket]}
                </a>
              ) : null}
            </>
          ) : (
            <p className="mt-4 admin-card p-5 text-secondary">Nobody on this list right now. Check the other lists, or come back tomorrow.</p>
          )
        ) : null}
      </section>
    </>
  );
}
