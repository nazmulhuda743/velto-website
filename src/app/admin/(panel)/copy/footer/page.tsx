import { AdminHeader, Badge, Notice, one, type SearchParams } from "@/components/admin/ui";
import { defaultFooterLinks } from "@/content/footer-defaults";
import { requireSection } from "@/lib/admin/session";
import { FOOTER_COLUMNS, FOOTER_MAX_LINKS, type FooterColumn, type FooterLink } from "@/lib/footer-links";
import { getSiteContent } from "@/lib/site-content";
import { saveFooterColumnAction } from "../../../footer-actions";

const COLUMNS: Record<FooterColumn, { title: string; hint: string }> = {
  services: { title: "Services column", hint: "Under the “Services” heading. Built in: All services and every service page." },
  help: { title: "Help column", hint: "Under the “Help” heading. Built in: Pricing, How it works, Regular laundry, Request a quote, Track an order, About." },
};

/** Spare empty rows under the current links, for adding new ones. */
const SPARE = 3;

export default async function FooterLinksPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("copy");
  const params = await searchParams;
  const { footer } = await getSiteContent();
  const builtIn = defaultFooterLinks();
  const saved = one(params.saved);
  const error = one(params.error);
  const errorColumn = one(params.column);

  return (
    <>
      <AdminHeader
        title="Footer links"
        intro="The link lists at the bottom of every page. Add a link, change its label or address, change the order or hide it. Saved changes are live straight away and recorded in Activity. The headings (“Services”, “Help”) are edited on Text & copy."
        actions={
          <a href="/#site-footer" target="_blank" rel="noopener noreferrer" className="admin-btn-secondary">
            See the footer ↗
          </a>
        }
      />
      <Notice saved={saved} error={error && !errorColumn ? error : undefined} />

      {FOOTER_COLUMNS.map((column) => {
        const custom = footer[column];
        const links: FooterLink[] = custom ?? builtIn[column];
        const rows = Math.min(links.length + SPARE, FOOTER_MAX_LINKS);
        const blank: FooterLink = { label: "", labelBn: "", href: "", hidden: false };
        return (
          <section key={column} id={column} aria-labelledby={`${column}-title`} className="admin-card mt-6 scroll-mt-6 p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`${column}-title`} className="t-h4 text-navy">
                {COLUMNS[column].title}
              </h2>
              <Badge tone={custom ? "blue" : "neutral"}>{custom ? "Edited" : "Built-in links"}</Badge>
            </div>
            <p className="mt-1 t-small text-secondary">{COLUMNS[column].hint}</p>
            {error && errorColumn === column ? (
              <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
                {error}
              </p>
            ) : null}
            {saved === column ? (
              <p role="status" className="mt-4 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
                Saved. The footer is updated.
              </p>
            ) : null}

            <form action={saveFooterColumnAction} className="mt-5">
              <input type="hidden" name="column" value={column} />
              <input type="hidden" name="rows" value={rows} />
              <div className="hidden grid-cols-[4rem_1fr_1fr_1.2fr_4.5rem] gap-3 px-1 t-caption font-semibold uppercase text-secondary md:grid">
                <span>Order</span>
                <span>Label</span>
                <span>Label in Bangla</span>
                <span>Link</span>
                <span>Show</span>
              </div>
              <ol className="mt-2 space-y-3">
                {Array.from({ length: rows }, (_, i) => {
                  const l = links[i] ?? blank;
                  const empty = !links[i];
                  return (
                    <li key={i} className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 md:grid-cols-[4rem_1fr_1fr_1.2fr_4.5rem] md:items-center md:border-0 md:p-1" data-footer-row={empty ? "new" : "link"}>
                      <label className="block">
                        <span className="t-caption font-semibold text-secondary md:sr-only">Order</span>
                        <input name={`${column}.order.${i}`} type="number" min={1} max={99} defaultValue={i + 1} className="admin-input" aria-label={`Row ${i + 1} order`} />
                      </label>
                      <label className="flex items-center gap-2 self-end md:order-last md:self-auto md:justify-center">
                        <input type="checkbox" name={`${column}.show.${i}`} defaultChecked={!l.hidden} className="size-4" />
                        <span className="t-small font-semibold text-navy md:sr-only">Show</span>
                      </label>
                      <label className="col-span-2 block md:col-span-1">
                        <span className="t-caption font-semibold text-secondary md:sr-only">Label</span>
                        <input name={`${column}.label.${i}`} defaultValue={l.label} maxLength={60} placeholder={empty ? "New link label" : undefined} className="admin-input" aria-label={`Row ${i + 1} label`} />
                      </label>
                      <label className="col-span-2 block md:col-span-1">
                        <span className="t-caption font-semibold text-secondary md:sr-only">Label in Bangla</span>
                        <input name={`${column}.labelBn.${i}`} lang="bn" defaultValue={l.labelBn} maxLength={60} placeholder="Optional" className="admin-input" aria-label={`Row ${i + 1} label in Bangla`} />
                      </label>
                      <label className="col-span-2 block md:col-span-1">
                        <span className="t-caption font-semibold text-secondary md:sr-only">Link</span>
                        <input name={`${column}.href.${i}`} defaultValue={l.href} maxLength={300} placeholder="/pricing or https://…" className="admin-input" aria-label={`Row ${i + 1} link`} />
                      </label>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 t-small text-secondary">
                To remove a link, clear its label and link. Untick “Show” to hide it but keep it for later. Links to other websites open in a new tab.
                Up to {FOOTER_MAX_LINKS} links; save to get more empty rows.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" name="intent" value="save" className="admin-btn">
                  Save {column === "services" ? "Services" : "Help"} links
                </button>
                {custom ? (
                  <button type="submit" name="intent" value="reset" className="admin-btn-secondary" formNoValidate>
                    Back to the built-in links
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        );
      })}
    </>
  );
}
