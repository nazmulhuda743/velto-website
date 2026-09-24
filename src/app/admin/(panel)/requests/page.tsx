import Link from "next/link";
import { AdminHeader, Badge, one, type SearchParams } from "@/components/admin/ui";
import { getWebsiteRequests } from "@/lib/admin/data";
import { requestDate, requestDetails } from "@/lib/admin/request-details";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "booking", label: "Bookings" },
  { key: "quote", label: "Quotes" },
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
];

const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  const intl = d.startsWith("880") ? d : d.startsWith("0") ? `88${d}` : d;
  return `https://wa.me/${intl}`;
};

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter = one(params.filter) ?? "all";
  const q = (one(params.q) ?? "").trim().toLowerCase().slice(0, 60);

  let error = false;
  let all: Awaited<ReturnType<typeof getWebsiteRequests>> = [];
  try {
    all = await getWebsiteRequests(500);
  } catch {
    error = true;
  }
  const rows = all.filter((r) => {
    if (filter === "booking" && r.source !== "website_booking") return false;
    if (filter === "quote" && r.source !== "website_quote") return false;
    if (filter === "open" && r.status === "done") return false;
    if (filter === "done" && r.status !== "done") return false;
    return !q || `${r.title} ${r.description ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <>
      <AdminHeader
        title="Bookings & quotes"
        intro="Every pickup booking and household quote sent from the website. They arrive in the Velto Ops task list, where staff assign and complete them."
      />
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/requests?${new URLSearchParams({ filter: f.key, ...(q ? { q } : {}) })}`}
              aria-current={filter === f.key ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 t-small font-semibold ${
                filter === f.key ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={q} placeholder="Search name, phone, area" className="admin-input md:w-64" aria-label="Search requests" />
          <button className="admin-btn-secondary" type="submit">
            Search
          </button>
        </form>
      </div>

      {error ? <p className="mt-6 t-small text-error">Couldn&apos;t load requests from Velto Ops right now.</p> : null}

      <p className="mt-6 t-small text-secondary">{rows.length} request{rows.length === 1 ? "" : "s"}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => {
          const d = requestDetails(r.description);
          return (
            <li key={r.id} className="admin-card">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
                  <Badge tone={r.source === "website_booking" ? "blue" : "amber"}>{r.source === "website_booking" ? "Booking" : "Quote"}</Badge>
                  <span className="font-semibold text-navy">{d.Name ?? r.title}</span>
                  <span className="t-small text-secondary">{d.Phone}</span>
                  <span className="t-small text-secondary">{d.Service ?? ""}</span>
                  <span className="ml-auto t-small text-secondary">{requestDate(r.created_at)}</span>
                  <Badge tone={r.status === "done" ? "green" : "neutral"}>{r.status}</Badge>
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <dl className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                    {Object.entries(d).map(([k, v]) => (
                      <div key={k}>
                        <dt className="t-caption uppercase tracking-[0.04em] text-secondary">{k}</dt>
                        <dd className="text-navy">{v}</dd>
                      </div>
                    ))}
                    <div>
                      <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Outlet</dt>
                      <dd className="text-navy">{r.outlet_code ?? "—"}</dd>
                    </div>
                    {r.done_by_name ? (
                      <div>
                        <dt className="t-caption uppercase tracking-[0.04em] text-secondary">Done by</dt>
                        <dd className="text-navy">{r.done_by_name}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {d.Phone ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`tel:${d.Phone.replace(/[^\d+]/g, "")}`} className="admin-btn-secondary">
                        Call
                      </a>
                      <a href={waLink(d.Phone)} target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
                        WhatsApp
                      </a>
                    </div>
                  ) : null}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
