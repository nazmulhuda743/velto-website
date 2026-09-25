import { BarList, fmt } from "@/components/admin/charts";
import { CampaignLinkBuilder } from "@/components/admin/CampaignLinkBuilder";
import { ConversionTable, DataTable, Td } from "@/components/admin/tables";
import { AdminHeader, DataNotice, Panel, RangePicker, type SearchParams } from "@/components/admin/ui";
import { SEO_ROUTES } from "@/content/seo-routes";
import { isAnalyticsWritesEnabled, sessionsFor } from "@/lib/admin/analytics-data";
import { byChannel, pageLabel, pct, utmTable } from "@/lib/admin/insights";
import { readDashboardParams } from "@/lib/admin/page-helpers";
import { SITE_URL } from "@/lib/seo/site";

export const metadata = { title: "Marketing · Velto Command Center" };

const LINK_PAGES = SEO_ROUTES.filter((r) => !["/privacy", "/terms", "/cookies"].includes(r.path)).map((r) => ({ path: r.path, label: r.label, group: r.group }));

export default async function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  const { flat, range } = readDashboardParams(await searchParams);
  const loaded = await sessionsFor(range);
  const rows = loaded.state === "ok" ? loaded.data.rows : [];
  const channels = byChannel(rows);
  const utm = utmTable(rows);
  const tagged = rows.filter((s) => s.utm_source || s.utm_medium || s.utm_campaign).length;

  return (
    <>
      <AdminHeader
        title="Acquisition & campaigns"
        intro={`Where visitors came from and which campaigns led to requests · ${range.label}.`}
        actions={<RangePicker basePath="/admin/marketing" params={flat} active={range.key} from={flat.from} to={flat.to} />}
      />
      {loaded.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
      {loaded.state === "error" ? <DataNotice state="error" message={loaded.message} /> : null}
      {loaded.state === "ok" && !loaded.preview && !isAnalyticsWritesEnabled() ? <DataNotice state="off" /> : null}

      <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <Panel title="Traffic by source" intro="Share of sessions.">
          <BarList
            total={rows.length}
            items={channels.filter((c) => c.sessions).map((c) => ({ key: c.key, label: c.label, value: c.sessions, sub: `${pct(c.conversionRate)} converted` }))}
          />
        </Panel>
        <Panel title="Conversions by source">
          <ConversionTable rows={channels} label="Source" caption="Conversions by acquisition source" />
          <p className="mt-4 t-caption text-secondary">
            Paid channels are only claimed when the link carries a paid utm_medium (e.g. paid_social, cpc) or a Google click id. Facebook links
            without UTMs count as Referral, and visits without a referrer as Direct — nothing is guessed.
          </p>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Campaigns (UTM)"
        intro={`${fmt(tagged)} of ${fmt(rows.length)} sessions arrived with UTM tags (${pct(rows.length ? tagged / rows.length : null)}).`}
      >
        {utm.length === 0 ? (
          <p className="t-small text-secondary">No tagged campaign traffic in this period. Use the link builder below for every ad and shared link.</p>
        ) : (
          <DataTable leftCols={4} caption="Campaign performance by UTM" head={["Campaign", "Source / medium", "Content", "Landing page", "Sessions", "Starts", "Bookings", "Quotes", "WhatsApp", "Conv."]}>
            {utm.map((r) => (
              <tr key={r.key}>
                <Td first>{r.campaign || "—"}</Td>
                <Td left>
                  {r.source || "—"} / {r.medium || "—"}
                </Td>
                <Td left>{r.content || "—"}</Td>
                <Td left>{r.landing ? pageLabel(r.landing) : "—"}</Td>
                <Td>{fmt(r.sessions)}</Td>
                <Td>{fmt(r.bookingStarts)}</Td>
                <Td>{fmt(r.bookings)}</Td>
                <Td>{fmt(r.quotes)}</Td>
                <Td>{fmt(r.whatsapp)}</Td>
                <Td className="font-semibold">{pct(r.conversionRate)}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <section id="link-builder" aria-labelledby="builder-title" className="admin-card mt-6 p-5 md:p-6">
        <h2 id="builder-title" className="text-[17px] font-semibold text-navy">
          Create tracked campaign link
        </h2>
        <p className="mt-1 t-small text-secondary">Every Facebook, Instagram or Google ad and every shared link should use one of these, so its results appear above.</p>
        <div className="mt-5">
          <CampaignLinkBuilder origin={SITE_URL} pages={LINK_PAGES} />
        </div>
      </section>
    </>
  );
}
