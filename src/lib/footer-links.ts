import { promoHrefOk } from "./promo";

/**
 * Footer link columns edited in the admin (Content → Footer links). A column that has never been
 * saved is null and the website shows its built-in links; once saved, the list is exactly what
 * the admin set (order, labels in both languages, hidden links kept for later).
 */
export type FooterLink = { label: string; labelBn: string; href: string; hidden: boolean };
export type FooterColumn = "services" | "help";
export type FooterLinks = Record<FooterColumn, FooterLink[] | null>;

export const FOOTER_COLUMNS: FooterColumn[] = ["services", "help"];
export const FOOTER_MAX_LINKS = 12;
export const EMPTY_FOOTER_LINKS: FooterLinks = { services: null, help: null };

/** A page on this website ("/pricing", "/book?source=footer") or a full https:// link; never empty. */
export const footerHrefOk = (href: string) => href !== "" && promoHrefOk(href);

/** Links to other websites open in a new tab. */
export const isExternalHref = (href: string) => href.startsWith("https://");

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parseColumn(v: unknown): FooterLink[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .flatMap((item) => {
      const r = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const label = str(r.label, 60);
      const href = str(r.href, 300);
      if (!label || !footerHrefOk(href)) return [];
      return [{ label, labelBn: str(r.labelBn, 60), href, hidden: r.hidden === true }];
    })
    .slice(0, FOOTER_MAX_LINKS);
}

export function parseFooterLinks(v: unknown): FooterLinks {
  const r = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return { services: parseColumn(r.services), help: parseColumn(r.help) };
}

/** The label in the page language; Bangla falls back to the English label. */
export const footerLabel = (link: FooterLink, locale: string) => (locale === "bn" && link.labelBn ? link.labelBn : link.label);

/** The links a visitor sees, in order. */
export const visibleFooterLinks = (links: FooterLink[]) => links.filter((l) => !l.hidden);

/**
 * Rows posted by the admin form ("<column>.<field>.<n>") → the saved list, sorted by the order
 * number (ties keep the form order). Rows without a label and link are dropped; a row with only
 * one of them is an error so nothing is lost silently.
 */
export function footerLinksFromForm(get: (name: string) => string, column: FooterColumn, rows: number): { links: FooterLink[] } | { error: string } {
  const picked: { link: FooterLink; order: number; i: number }[] = [];
  for (let i = 0; i < rows; i++) {
    const label = get(`${column}.label.${i}`).trim().slice(0, 60);
    const labelBn = get(`${column}.labelBn.${i}`).trim().slice(0, 60);
    const href = get(`${column}.href.${i}`).trim().slice(0, 300);
    if (!label && !href && !labelBn) continue;
    if (!label || !href) return { error: `Row ${i + 1}: give the link both an English label and an address.` };
    if (!footerHrefOk(href)) return { error: `Row ${i + 1}: “${href}” must be a page like /pricing or a full https:// address.` };
    const order = Number.parseInt(get(`${column}.order.${i}`), 10);
    picked.push({ link: { label, labelBn, href, hidden: get(`${column}.show.${i}`) !== "on" }, order: Number.isFinite(order) ? order : i + 1, i });
  }
  if (picked.length > FOOTER_MAX_LINKS) return { error: `Keep each column to ${FOOTER_MAX_LINKS} links or fewer.` };
  if (picked.length && picked.every((p) => p.link.hidden)) return { error: "Show at least one link, or use “Back to the built-in links”." };
  return { links: picked.sort((a, b) => a.order - b.order || a.i - b.i).map((p) => p.link) };
}
