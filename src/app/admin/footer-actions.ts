"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/admin/activity";
import { saveContent } from "@/lib/admin/content-store";
import { requireSection } from "@/lib/admin/session";
import { logServerEvent } from "@/lib/analytics/store";
import { FOOTER_COLUMNS, FOOTER_MAX_LINKS, footerLinksFromForm, type FooterColumn, type FooterLinks } from "@/lib/footer-links";
import { getSiteContent } from "@/lib/site-content";

const PAGE = "/admin/copy/footer";
const back = (params: Record<string, string>): never => redirect(`${PAGE}?${new URLSearchParams(params)}#${params.column ?? ""}`);
const NAMES: Record<FooterColumn, string> = { services: "Services", help: "Help" };

/** Save one footer column, or put it back to the built-in links ("reset"). */
export async function saveFooterColumnAction(form: FormData) {
  const admin = await requireSection("copy");
  const column = String(form.get("column") ?? "") as FooterColumn;
  if (!FOOTER_COLUMNS.includes(column)) back({ error: "Unknown footer column." });
  const { footer } = await getSiteContent();
  const reset = form.get("intent") === "reset";
  let links: FooterLinks[FooterColumn] = null;
  if (!reset) {
    const rows = Math.min(Math.max(Number.parseInt(String(form.get("rows") ?? "0"), 10) || 0, 0), FOOTER_MAX_LINKS + 8);
    const parsed = footerLinksFromForm((name) => String(form.get(name) ?? ""), column, rows);
    if ("error" in parsed) back({ error: parsed.error, column });
    else links = parsed.links.length ? parsed.links : null;
  }
  const next: FooterLinks = { ...footer, [column]: links };
  try {
    await saveContent("footer", next, admin.name);
  } catch (e) {
    await logServerEvent("content_save_error", PAGE);
    back({ error: (e instanceof Error ? e.message : "Something went wrong.").slice(0, 160), column });
  }
  await logActivity(admin, {
    section: "copy",
    action: reset ? "footer_links_reset" : "footer_links_saved",
    summary: links
      ? `Footer “${NAMES[column]}” links saved: ${links.filter((l) => !l.hidden).length} shown${links.some((l) => l.hidden) ? `, ${links.filter((l) => l.hidden).length} hidden` : ""}`
      : `Footer “${NAMES[column]}” back to the built-in links`,
    detail: { column, before: footer[column], after: links },
  });
  back({ saved: column, column });
}
