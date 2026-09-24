import { AdminHeader, one, type SearchParams } from "@/components/admin/ui";
import { getAllPrices } from "@/lib/admin/data";
import { formatAmount } from "@/lib/format-price";

const COLUMNS = [
  { slug: "dry-cleaning", label: "Dry Cleaning" },
  { slug: "wash-and-iron", label: "Wash & Iron" },
  { slug: "ironing", label: "Ironing" },
];

export default async function PricesPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (one((await searchParams).q) ?? "").trim().toLowerCase().slice(0, 60);
  let items: Awaited<ReturnType<typeof getAllPrices>> = [];
  let error = false;
  try {
    items = await getAllPrices();
  } catch {
    error = true;
  }
  const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  return (
    <>
      <AdminHeader
        title="Prices"
        intro="What the website shows right now. Prices come from the Velto Ops price list — change them in Ops and the website updates within five minutes."
      />
      <form className="mt-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search items" aria-label="Search items" className="admin-input md:w-72" />
        <button type="submit" className="admin-btn-secondary">
          Search
        </button>
      </form>
      {error ? <p className="mt-6 t-small text-error">Couldn&apos;t load prices right now.</p> : null}
      <p className="mt-4 t-small text-secondary">
        {shown.length} of {items.length} items
      </p>
      <div className="admin-card mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="px-5 py-3 t-label uppercase text-navy">Item</th>
              {COLUMNS.map((c) => (
                <th key={c.slug} className="px-5 py-3 text-right t-label uppercase text-navy">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => {
              const by = new Map(item.services.map((s) => [s.slug, s]));
              return (
                <tr key={item.slug} className="border-b border-line last:border-0">
                  <td className="px-5 py-2.5 text-navy">{item.name}</td>
                  {COLUMNS.map((c) => {
                    const s = by.get(c.slug);
                    return (
                      <td key={c.slug} className="px-5 py-2.5 text-right tabular-nums">
                        {!s ? (
                          <span className="text-muted">—</span>
                        ) : s.amountMinor === null ? (
                          <span className="t-small text-secondary">On inspection</span>
                        ) : (
                          <>
                            {formatAmount(s.amountMinor)}
                            {s.unitLabel ? <span className="ml-1 t-caption text-secondary">{s.unitLabel}</span> : null}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
