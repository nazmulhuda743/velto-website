import { AdminHeader, Badge, DataNotice, Field, Notice, one, type SearchParams } from "@/components/admin/ui";
import { getLoyaltyDistribution } from "@/lib/admin/customer-extras";
import { canEditLoyalty } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { getSiteContent } from "@/lib/site-content";
import { saveLoyaltyAction } from "../../customer-actions";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

export default async function LoyaltyPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("loyalty");
  const params = await searchParams;
  const editable = canEditLoyalty(admin.role);
  const { loyalty } = await getSiteContent();
  const dist = await getLoyaltyDistribution(loyalty.windowMonths, loyalty.tiers.map((t) => t.min));
  // Room for up to six tiers; empty rows beyond the current ones can add a tier.
  const rows = [...loyalty.tiers, ...Array.from({ length: Math.max(0, 6 - loyalty.tiers.length) }, () => null)];

  return (
    <>
      <AdminHeader
        title="Loyalty"
        intro="Tiers customers see in their website account, counted from their own Velto orders, and an optional reward every few orders. Benefits and rewards are promises to customers: only an Owner can change them, and Velto staff apply them to orders."
        actions={<Badge tone={loyalty.enabled ? "green" : "neutral"}>{loyalty.enabled ? "Shown to customers" : "Off"}</Badge>}
      />
      <Notice saved={one(params.saved)} error={one(params.error)} />

      <section aria-labelledby="dist-title" className="admin-card mt-6 p-5 md:p-7">
        <h2 id="dist-title" className="t-h4 text-navy">
          Customers per tier
        </h2>
        <p className="mt-1 t-small text-secondary">
          Every Velto customer with an order in the last {loyalty.windowMonths} months (not only website accounts), with the tiers as set below. Cancelled orders are not counted.
        </p>
        {dist.state !== "ok" ? (
          <DataNotice state={dist.state} message={dist.state === "error" ? dist.message : undefined} />
        ) : (
          <>
            {dist.preview ? <DataNotice state="preview" /> : null}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left t-small">
                <thead className="border-b border-line text-secondary">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">Tier</th>
                    <th className="py-2 pr-4 font-semibold">Orders</th>
                    <th className="py-2 pr-4 text-right font-semibold">Customers</th>
                    <th className="py-2 pr-4 text-right font-semibold">Share of customers</th>
                    <th className="py-2 text-right font-semibold">Share of spend</th>
                  </tr>
                </thead>
                <tbody>
                  {loyalty.tiers.map((t, i) => {
                    const g = dist.data.tiers.find((x) => Number(x.tier) === i + 1);
                    const next = loyalty.tiers[i + 1];
                    return (
                      <tr key={t.name} className="border-b border-line last:border-0">
                        <td className="py-2.5 pr-4 font-semibold text-navy">{t.name}</td>
                        <td className="py-2.5 pr-4 text-body">{next ? `${t.min}–${next.min - 1}` : `${t.min}+`}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-navy">{(g?.customers ?? 0).toLocaleString("en-IN")}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-body">{dist.data.customers ? `${Math.round(((g?.customers ?? 0) / dist.data.customers) * 100)}%` : "–"}</td>
                        <td className="py-2.5 text-right tabular-nums text-body">{dist.data.spend ? `${Math.round(((g?.spend ?? 0) / dist.data.spend) * 100)}%` : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 t-caption text-secondary">
              {dist.data.customers.toLocaleString("en-IN")} customers, {taka(dist.data.spend)} in orders over the period.
            </p>
          </>
        )}
      </section>

      <form action={saveLoyaltyAction} className="admin-card mt-6 p-5 md:p-7">
        <fieldset disabled={!editable} className="space-y-6">
          <legend className="t-h4 text-navy">Tiers and rewards</legend>
          {!editable ? <p className="t-small text-secondary">You can view these. Only an Owner can change them.</p> : null}

          <label className="flex items-center gap-3">
            <input type="checkbox" name="enabled" defaultChecked={loyalty.enabled} className="size-4" />
            <span className="font-semibold text-navy">Show the tier card in customer accounts</span>
          </label>

          <div className="max-w-xs">
            <Field label="Count orders over (months)" hint="A tier reflects recent custom. 12 is usual.">
              <input name="windowMonths" type="number" min={1} max={36} step={1} defaultValue={loyalty.windowMonths} className="admin-input" />
            </Field>
          </div>

          <input type="hidden" name="tierCount" value={6} />
          <div className="space-y-3">
            <p className="text-[15px] font-semibold text-navy">Tiers, lowest first</p>
            <p className="t-small text-secondary">
              Leave a row&apos;s name empty to drop it (at least two tiers). Benefits are shown exactly as written; leave them empty until they are decided.
            </p>
            {rows.map((t, i) => (
              <fieldset key={i} className="grid gap-3 rounded-md border border-line p-4 md:grid-cols-[1fr_1fr_110px]">
                <legend className="px-1 t-small font-semibold text-secondary">Tier {i + 1}</legend>
                <Field label="Name">
                  <input name={`name${i}`} defaultValue={t?.name ?? ""} maxLength={30} className="admin-input" />
                </Field>
                <Field label="Name in Bangla">
                  <input name={`nameBn${i}`} lang="bn" defaultValue={t?.nameBn ?? ""} maxLength={30} className="admin-input" />
                </Field>
                <Field label="From (orders)">
                  {i === 0 ? (
                    <input value={1} readOnly aria-readonly className="admin-input bg-soft" />
                  ) : (
                    <input name={`min${i}`} type="number" min={2} max={500} step={1} defaultValue={t?.min ?? ""} className="admin-input" />
                  )}
                </Field>
                <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
                  <Field label="Benefits" hint="What this tier gets, e.g. “Free express on one order a month”.">
                    <textarea name={`perks${i}`} rows={2} maxLength={300} defaultValue={t?.perks ?? ""} className="admin-input" />
                  </Field>
                  <Field label="Benefits in Bangla">
                    <textarea name={`perksBn${i}`} lang="bn" rows={2} maxLength={300} defaultValue={t?.perksBn ?? ""} className="admin-input" />
                  </Field>
                </div>
              </fieldset>
            ))}
          </div>

          <div className="space-y-3 rounded-md border border-line p-4">
            <p className="text-[15px] font-semibold text-navy">Milestone reward</p>
            <p className="t-small text-secondary">A stamp card on the account: every Nth order (all time) earns the reward. Shown only when a reward is written.</p>
            <div className="grid gap-3 md:grid-cols-[140px_1fr_1fr]">
              <Field label="Every (orders)" hint="0 = none.">
                <input name="every" type="number" min={0} max={50} step={1} defaultValue={loyalty.milestone.every} className="admin-input" />
              </Field>
              <Field label="Reward">
                <input name="reward" defaultValue={loyalty.milestone.reward} maxLength={200} className="admin-input" />
              </Field>
              <Field label="Reward in Bangla">
                <input name="rewardBn" lang="bn" defaultValue={loyalty.milestone.rewardBn} maxLength={200} className="admin-input" />
              </Field>
            </div>
          </div>

          {editable ? (
            <button type="submit" className="admin-btn">
              Save loyalty
            </button>
          ) : null}
        </fieldset>
      </form>
    </>
  );
}
