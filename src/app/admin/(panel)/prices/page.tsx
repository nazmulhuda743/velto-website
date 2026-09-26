import Link from "next/link";
import { AdminHeader, Badge, DataNotice, Notice, one, type SearchParams } from "@/components/admin/ui";
import { canProposePrices } from "@/lib/admin/permissions";
import { getAdminPrices, getPriceChanges, type AdminPriceRow } from "@/lib/admin/price-changes";
import { taka } from "@/lib/admin/price-diff";
import { requestDate } from "@/lib/admin/request-details";
import { requireSection } from "@/lib/admin/session";
import { cancelPriceAction, proposePriceAction } from "../../price-actions";

const SERVICES = ["Dry Cleaning", "Wash + Iron", "Ironing"] as const;
const SERVICE_LABEL: Record<string, string> = { "Dry Cleaning": "Dry Cleaning", "Wash + Iron": "Wash & Iron", Ironing: "Ironing" };
const GROUPS = ["Men", "Women", "Household", "Special"];

const SAVED: Record<string, string> = {
  requested: "Sent for approval. Nothing changes in Ops or on the website until an Owner approves it.",
  applied: "Saved. Velto Ops and the website now use the new price.",
  withdrawn: "Request withdrawn.",
};

function PriceForm({
  row,
  kind,
  defaults,
  categories,
  back,
  owner,
}: {
  row: AdminPriceRow | null;
  kind: "add" | "edit";
  defaults: { item_name?: string; service_category?: string };
  categories: string[];
  back: string;
  owner: boolean;
}) {
  const v = row ?? ({} as Partial<AdminPriceRow>);
  return (
    <form action={proposePriceAction} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="back" value={back} />
      {row ? <input type="hidden" name="priceId" value={row.id} /> : null}
      <label className="block t-small font-semibold text-navy">
        Item name
        <input name="item_name" required minLength={2} maxLength={120} defaultValue={v.item_name ?? defaults.item_name ?? ""} className="admin-input mt-1" />
      </label>
      <label className="block t-small font-semibold text-navy">
        Service
        <select name="service_category" required defaultValue={v.service_category ?? defaults.service_category ?? "Dry Cleaning"} className="admin-input mt-1">
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {SERVICE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-small font-semibold text-navy">
        Price type
        <select name="price_type" defaultValue={v.price_type ?? "fixed"} className="admin-input mt-1">
          <option value="fixed">Fixed price per item</option>
          <option value="per_sqft">Per square foot</option>
          <option value="poa">On inspection (no price shown)</option>
        </select>
      </label>
      <label className="block t-small font-semibold text-navy">
        Price in taka <span className="font-normal text-secondary">(leave empty for “on inspection”)</span>
        <input name="price" inputMode="decimal" pattern="[0-9.,]*" defaultValue={v.price ?? ""} className="admin-input mt-1" />
      </label>
      <label className="block t-small font-semibold text-navy">
        Category
        <input name="category" required list="price-categories" maxLength={60} defaultValue={v.category ?? ""} className="admin-input mt-1" />
        <datalist id="price-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="block t-small font-semibold text-navy">
        Group
        <select name="item_group" defaultValue={v.item_group ?? ""} className="admin-input mt-1">
          <option value="">None</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <label className="block t-small font-semibold text-navy">
        Hanger
        <select name="hanger" defaultValue={v.hanger ?? ""} className="admin-input mt-1">
          <option value="">No hanger</option>
          <option value="request">On request</option>
          <option value="must">Must be hung</option>
        </select>
      </label>
      <label className="block t-small font-semibold text-navy">
        Note <span className="font-normal text-secondary">(optional)</span>
        <input name="note" maxLength={200} defaultValue={v.note ?? ""} className="admin-input mt-1" />
      </label>
      <label className="flex items-center gap-2 t-small font-semibold text-navy md:col-span-2">
        <input type="checkbox" name="is_popular" defaultChecked={Boolean(v.is_popular)} className="size-4" />
        Popular item
      </label>
      <label className="block t-small font-semibold text-navy md:col-span-2">
        Why this change? <span className="font-normal text-secondary">(helps the Owner approve)</span>
        <input name="reason" maxLength={500} className="admin-input mt-1" />
      </label>
      <div className="md:col-span-2">
        <button type="submit" className="admin-btn">
          {owner ? (kind === "add" ? "Add price" : "Save price") : kind === "add" ? "Send new item for approval" : "Send change for approval"}
        </button>
      </div>
    </form>
  );
}

export default async function PricesPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("prices");
  const params = await searchParams;
  const q = (one(params.q) ?? "").trim().slice(0, 60);
  const showRemoved = one(params.removed) === "1";
  const editId = Number(one(params.edit)) || null;
  const adding = one(params.add) === "1";
  const editable = canProposePrices(admin.role);
  const owner = admin.role === "owner";

  const [prices, pending] = await Promise.all([getAdminPrices(), getPriceChanges("pending", 200)]);
  const rows = prices.state === "ok" ? prices.data : [];
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  const editing = editId ? rows.find((r) => r.id === editId) ?? null : null;
  const keep = { ...(q ? { q } : {}), ...(showRemoved ? { removed: "1" } : {}) };
  const href = (extra: Record<string, string>) => `/admin/prices?${new URLSearchParams({ ...keep, ...extra })}`;
  const back = `/admin/prices${Object.keys(keep).length ? `?${new URLSearchParams(keep)}` : ""}`;

  // One table row per item name; a column per service.
  const needle = q.toLowerCase();
  const byItem = new Map<string, AdminPriceRow[]>();
  for (const r of rows) {
    if (!showRemoved && !r.active) continue;
    if (needle && !`${r.item_name} ${r.category}`.toLowerCase().includes(needle)) continue;
    byItem.set(r.item_name, [...(byItem.get(r.item_name) ?? []), r]);
  }
  const items = [...byItem.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const myPending = pending.state === "ok" ? pending.data.filter((c) => owner || c.requested_by_id === admin.id) : [];

  return (
    <>
      <AdminHeader
        title="Prices"
        intro={
          owner
            ? "The Velto Ops price list. Your changes apply to Ops billing and the website straight away; Managers' changes wait for you on the Approvals page."
            : editable
              ? "The Velto Ops price list. Add, change or remove prices here: each change waits for an Owner's approval, then updates Ops billing and the website together."
              : "The Velto Ops price list, as Ops bills it and the website shows it."
        }
        actions={
          editable ? (
            <Link href={href({ add: "1" })} className="admin-btn">
              + Add item
            </Link>
          ) : undefined
        }
      />
      <Notice error={one(params.error)} />
      {one(params.saved) && SAVED[one(params.saved)!] && !one(params.error) ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[one(params.saved)!]}
        </p>
      ) : null}
      {prices.state === "ok" && prices.preview ? <DataNotice state="preview" /> : null}
      {prices.state === "error" ? <DataNotice state="error" message={prices.message} /> : null}
      {prices.state === "not_configured" ? <DataNotice state="not_configured" /> : null}

      {editable && (adding || editing) ? (
        <section aria-labelledby="edit-title" className="admin-card mt-6 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="edit-title" className="text-[17px] font-semibold text-navy">
              {editing ? `Edit ${editing.item_name} · ${SERVICE_LABEL[editing.service_category]}` : "Add an item"}
            </h2>
            <Link href={back} className="t-small font-semibold text-navy underline underline-offset-4">
              Close
            </Link>
          </div>
          {editing?.pending ? (
            <p className="mt-3 rounded-md bg-[#fff4e5] px-3 py-2 t-small text-[#8a5300]">
              {editing.pending.by} already asked to {editing.pending.kind} this price on {requestDate(editing.pending.at)}. It must be approved or withdrawn first.
            </p>
          ) : (
            <div className="mt-4">
              {editing && !editing.active ? (
                <p className="mb-4 t-small text-secondary">This price is removed: Ops doesn&apos;t offer it and the website doesn&apos;t show it.</p>
              ) : null}
              {!editing || editing.active ? (
                <PriceForm
                  row={editing}
                  kind={editing ? "edit" : "add"}
                  defaults={{ item_name: one(params.item), service_category: one(params.service) }}
                  categories={categories}
                  back={back}
                  owner={owner}
                />
              ) : null}
              {editing ? (
                <form action={proposePriceAction} className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                  <input type="hidden" name="kind" value={editing.active ? "remove" : "restore"} />
                  <input type="hidden" name="priceId" value={editing.id} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="label" value={`${editing.item_name} (${SERVICE_LABEL[editing.service_category]})`} />
                  <label className="block min-w-[14rem] flex-1 t-small font-semibold text-navy">
                    Reason <span className="font-normal text-secondary">(optional)</span>
                    <input name="reason" maxLength={500} className="admin-input mt-1" />
                  </label>
                  <button type="submit" className={editing.active ? "admin-btn-danger" : "admin-btn-secondary"}>
                    {editing.active ? (owner ? "Remove this price" : "Ask to remove this price") : owner ? "Restore this price" : "Ask to restore this price"}
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {myPending.length ? (
        <section aria-labelledby="pending-title" className="admin-card mt-6 p-5">
          <h2 id="pending-title" className="text-[17px] font-semibold text-navy">
            {owner ? "Waiting for approval" : "Your requests waiting for approval"}
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {myPending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <p className="t-small text-navy">
                  <span className="font-semibold capitalize">{c.kind}</span> {c.proposed.item_name || c.before?.item_name}
                  {c.proposed.service_category || c.before?.service_category ? ` · ${SERVICE_LABEL[c.proposed.service_category || c.before!.service_category]}` : ""}
                  {c.kind === "add" || c.kind === "edit" ? ` → ${taka(c.proposed.price ?? null, c.proposed.price_type)}` : ""}
                  <span className="text-secondary">
                    {" "}
                    · {c.requested_by_name}, {requestDate(c.requested_at)}
                  </span>
                </p>
                <div className="flex gap-2">
                  {owner ? (
                    <Link href={`/admin/approvals#c-${c.id}`} className="admin-btn-secondary">
                      Review
                    </Link>
                  ) : null}
                  <form action={cancelPriceAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="admin-btn-secondary">
                      Withdraw
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="mt-6 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search items or categories" aria-label="Search items" className="admin-input md:w-72" />
        {showRemoved ? <input type="hidden" name="removed" value="1" /> : null}
        <button type="submit" className="admin-btn-secondary">
          Search
        </button>
        <Link href={`/admin/prices?${new URLSearchParams({ ...(q ? { q } : {}), ...(showRemoved ? {} : { removed: "1" }) })}`} className="t-small font-semibold text-navy underline underline-offset-4">
          {showRemoved ? "Hide removed prices" : "Show removed prices"}
        </Link>
      </form>
      <p className="mt-4 t-small text-secondary">
        {items.length} item{items.length === 1 ? "" : "s"}
        {editable ? ". Click a price to change it, or + to add a service." : "."}
      </p>

      <div className="admin-card mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Price list">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="px-5 py-3 t-label uppercase text-navy">Item</th>
              {SERVICES.map((s) => (
                <th key={s} className="px-5 py-3 text-right t-label uppercase text-navy">
                  {SERVICE_LABEL[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(([name, list]) => (
              <tr key={name} className="border-b border-line last:border-0">
                <td className="px-5 py-2.5">
                  <span className="text-navy">{name}</span>
                  <span className="block t-caption text-secondary">{list[0].category}</span>
                </td>
                {SERVICES.map((s) => {
                  const r = list.find((x) => x.service_category === s);
                  const label = r ? taka(r.price, r.price_type) : null;
                  return (
                    <td key={s} className="px-5 py-2.5 text-right tabular-nums">
                      {!r ? (
                        editable ? (
                          <Link href={href({ add: "1", item: name, service: s })} aria-label={`Add ${SERVICE_LABEL[s]} price for ${name}`} className="t-small font-semibold text-blue hover:underline">
                            +
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )
                      ) : (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          {editable ? (
                            <Link href={href({ edit: String(r.id) })} className={`hover:underline ${r.active ? "text-navy" : "text-secondary line-through"}`}>
                              {label}
                            </Link>
                          ) : (
                            <span className={r.active ? "text-navy" : "text-secondary line-through"}>{label}</span>
                          )}
                          {r.pending ? <Badge tone="amber">{r.pending.kind} pending</Badge> : null}
                          {!r.active ? <span className="t-caption text-secondary">Removed</span> : null}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
