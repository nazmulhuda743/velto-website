import Link from "next/link";
import { AdminHeader, Badge, Notice, one, type SearchParams } from "@/components/admin/ui";
import { SEO_ROUTES, type SeoRoute } from "@/content/seo-routes";
import { getSiteContent, type SeoEntry } from "@/lib/site-content";
import { requireSection } from "@/lib/admin/session";

type Flag = { key: string; label: string; tone: "neutral" | "blue" | "green" | "amber" };

/** What an owner should know about a page's search/share setup. */
function flags(route: SeoRoute, o: SeoEntry | undefined): Flag[] {
  const out: Flag[] = [];
  if (!(o?.title ?? route.title)) out.push({ key: "no-title", label: "Missing title", tone: "amber" });
  if (!(o?.description ?? route.description)) out.push({ key: "no-description", label: "Missing description", tone: "amber" });
  if (o?.noindex) out.push({ key: "noindex", label: "Hidden from Google", tone: "amber" });
  out.push(o && (o.title || o.description || o.titleBn || o.descriptionBn || o.ogImage || o.noindex) ? { key: "custom", label: "Custom", tone: "blue" } : { key: "default", label: "Default", tone: "neutral" });
  out.push(o?.ogImage ? { key: "og", label: "Share image", tone: "green" } : { key: "no-og", label: "No share image", tone: "neutral" });
  return out;
}

const VIEWS = [
  { key: "all", label: "All pages" },
  { key: "issues", label: "Needs attention" },
  { key: "noindex", label: "Hidden from Google" },
  { key: "custom", label: "Custom" },
  { key: "no-og", label: "No share image" },
];

export default async function SeoPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSection("seo");
  const params = await searchParams;
  const view = one(params.view) ?? "all";
  const { seo } = await getSiteContent();
  const rows = SEO_ROUTES.map((route) => ({ route, o: seo[route.path], f: flags(route, seo[route.path]) }));
  const matches = (r: (typeof rows)[number]) =>
    view === "all" ? true : view === "issues" ? r.f.some((f) => f.tone === "amber") : r.f.some((f) => f.key === view);
  const shown = rows.filter(matches);
  const groups = [...new Set(shown.map((r) => r.route.group))];
  const count = (key: string) => rows.filter((r) => (key === "issues" ? r.f.some((f) => f.tone === "amber") : key === "all" ? true : r.f.some((f) => f.key === key))).length;

  return (
    <>
      <AdminHeader
        title="SEO"
        intro="Title and description shown in Google results, the image used when a page is shared, and whether a page may be indexed. Leave a field empty to use the built-in text."
      />
      <Notice error={one(params.error)} />
      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter pages">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/seo?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 t-small font-semibold ${view === v.key ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
          >
            {v.label} <span className={view === v.key ? "text-white/70" : "text-secondary"}>{count(v.key)}</span>
          </Link>
        ))}
      </div>
      {shown.length === 0 ? <p className="admin-card mt-6 p-5 t-small text-secondary">No pages match this filter.</p> : null}
      {groups.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="t-label uppercase text-secondary">{group}</h2>
          <ul className="admin-card mt-3 overflow-hidden">
            {shown
              .filter((r) => r.route.group === group)
              .map(({ route, o, f }) => (
                <li key={route.path} className="border-b border-line last:border-0">
                  <Link
                    href={`/admin/seo/edit?${new URLSearchParams({ path: route.path })}`}
                    className="grid gap-1 px-5 py-4 hover:bg-soft md:grid-cols-[14rem_1fr] md:items-center md:gap-6 xl:grid-cols-[14rem_1fr_auto]"
                  >
                    <span>
                      <span className="block font-semibold text-navy">{route.label}</span>
                      <span className="block t-caption text-secondary">{route.path}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate t-small text-body">{o?.title ?? route.title}</span>
                      <span className="block truncate t-caption text-secondary">{o?.description ?? route.description}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 md:col-start-2 xl:col-start-auto">
                      {f.map((flag) => (
                        <Badge key={flag.key} tone={flag.tone}>
                          {flag.label}
                        </Badge>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
