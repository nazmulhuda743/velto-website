import Link from "next/link";
import { AdminHeader, Badge, DataNotice, one, type SearchParams } from "@/components/admin/ui";
import { getActivity, getPeople, type ActivityRow } from "@/lib/admin/activity";
import { isRole, ROLE_INFO } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";

const SECTION_LABEL: Record<string, string> = {
  session: "Sign-in",
  images: "Images",
  seo: "SEO",
  reviews: "Reviews",
  settings: "Site settings",
  accounts: "Customer accounts",
  retention: "Bring back",
  revenue: "Revenue",
  prices: "Prices",
  approvals: "Approvals",
  access: "Access",
};

const dhaka = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", ...opts });
const dayKey = (iso: string) => dhaka(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = (iso: string) => dhaka(iso, { hour: "2-digit", minute: "2-digit", hour12: true });

const isImageUrl = (v: unknown): v is string => typeof v === "string" && /^(https:\/\/|\/images\/)/.test(v);

/** Small, readable before/after facts. Image changes show both photos. */
function Detail({ row }: { row: ActivityRow }) {
  const d = row.detail ?? {};
  const entries = Object.entries(d).filter(([k]) => !["before", "after"].includes(k));
  const images = isImageUrl(d.before) || isImageUrl(d.after);
  if (!entries.length && !images) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer t-caption font-semibold text-blue">Details</summary>
      {images ? (
        <div className="mt-2 flex flex-wrap gap-3">
          {(["before", "after"] as const).map((k) =>
            isImageUrl(d[k]) ? (
              <figure key={k} className="w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d[k] as string} alt="" className="aspect-[4/3] w-full rounded-md border border-line object-cover" />
                <figcaption className="mt-1 t-caption text-secondary">{k === "before" ? "Before" : "After"}</figcaption>
              </figure>
            ) : null,
          )}
        </div>
      ) : null}
      {entries.length ? (
        <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 t-caption">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-secondary">{k}</dt>
              <dd className="text-navy [overflow-wrap:anywhere]">{Array.isArray(v) ? v.join(", ") : v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </details>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("activity");
  const params = await searchParams;
  const filter = { actor: one(params.actor), section: one(params.section), from: one(params.from), to: one(params.to) };
  const [activity, people] = await Promise.all([getActivity({ ...filter, limit: 500 }), getPeople()]);
  const rows = activity.state === "ok" ? activity.data : [];
  const days = new Map<string, ActivityRow[]>();
  for (const r of rows) days.set(dayKey(r.at), [...(days.get(dayKey(r.at)) ?? []), r]);

  return (
    <>
      <AdminHeader
        title="Activity"
        intro="Every change made in this dashboard and every sign-in: who, what and when (Dhaka time). The log can't be edited or deleted from the website."
      />

      <form className="admin-card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="block t-small font-semibold text-navy">
          Person
          <select name="actor" defaultValue={filter.actor ?? ""} className="admin-input mt-1">
            <option value="">Everyone</option>
            {people.state === "ok"
              ? people.data.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label className="block t-small font-semibold text-navy">
          Area
          <select name="section" defaultValue={filter.section ?? ""} className="admin-input mt-1">
            <option value="">All areas</option>
            {Object.entries(SECTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block t-small font-semibold text-navy">
          From
          <input type="date" name="from" defaultValue={filter.from} className="admin-input mt-1" />
        </label>
        <label className="block t-small font-semibold text-navy">
          To
          <input type="date" name="to" defaultValue={filter.to} className="admin-input mt-1" />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="admin-btn">
            Filter
          </button>
          <Link href="/admin/activity" className="admin-btn-secondary">
            Clear
          </Link>
        </div>
      </form>

      {activity.state === "ok" && activity.preview ? <DataNotice state="preview" /> : null}
      {activity.state === "error" ? <DataNotice state="error" message={activity.message} /> : null}
      {activity.state === "not_configured" ? <DataNotice state="not_configured" /> : null}

      {activity.state === "ok" && !rows.length ? <p className="admin-card mt-6 p-5 text-secondary">Nothing recorded for this filter yet.</p> : null}

      {[...days.entries()].map(([day, list]) => (
        <section key={day} aria-label={day} className="mt-8">
          <h2 className="t-label uppercase text-secondary">{day}</h2>
          <ol className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
            {list.map((r) => (
              <li key={r.id} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[5.5rem_1fr]">
                <time dateTime={r.at} className="pt-0.5 t-small font-semibold text-navy tabular-nums">
                  {time(r.at)}
                </time>
                <div className="min-w-0">
                  <p className="text-navy">
                    <span className="font-semibold">{r.actor_name}</span>{" "}
                    <span className="t-caption text-secondary">({isRole(r.actor_role) ? ROLE_INFO[r.actor_role].label : r.actor_role})</span> {r.summary}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={r.section === "access" ? "amber" : r.section === "session" ? "neutral" : "blue"}>{SECTION_LABEL[r.section] ?? r.section}</Badge>
                    {r.target ? <span className="t-caption text-secondary [overflow-wrap:anywhere]">{r.target}</span> : null}
                  </div>
                  <Detail row={r} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {rows.length >= 500 ? <p className="mt-4 t-small text-secondary">Showing the latest 500. Narrow the filter to see older entries.</p> : null}
    </>
  );
}
