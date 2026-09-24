import Link from "next/link";
import { AdminHeader, Badge, Notice, one, type SearchParams } from "@/components/admin/ui";
import { SEO_ROUTES } from "@/content/seo-routes";
import { getSiteContent } from "@/lib/site-content";

export default async function SeoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { seo } = await getSiteContent();
  const groups = [...new Set(SEO_ROUTES.map((r) => r.group))];
  return (
    <>
      <AdminHeader
        title="SEO"
        intro="Title and description shown in Google results, the image used when a page is shared, and whether a page may be indexed. Leave a field empty to use the built-in text."
      />
      <Notice error={one(params.error)} />
      {groups.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="t-label uppercase text-secondary">{group}</h2>
          <ul className="admin-card mt-3 overflow-hidden">
            {SEO_ROUTES.filter((r) => r.group === group).map((route) => {
              const o = seo[route.path];
              return (
                <li key={route.path} className="border-b border-line last:border-0">
                  <Link
                    href={`/admin/seo/edit?${new URLSearchParams({ path: route.path })}`}
                    className="grid gap-1 px-5 py-4 hover:bg-soft md:grid-cols-[14rem_1fr_auto] md:items-center md:gap-6"
                  >
                    <span>
                      <span className="block font-semibold text-navy">{route.label}</span>
                      <span className="block t-caption text-secondary">{route.path}</span>
                    </span>
                    <span className="min-w-0 truncate t-small text-body">{o?.title ?? route.title}</span>
                    <span className="flex gap-1.5">
                      {o ? <Badge tone="blue">Custom</Badge> : <Badge>Default</Badge>}
                      {o?.noindex ? <Badge tone="amber">Hidden from Google</Badge> : null}
                      {o?.ogImage ? <Badge tone="green">Share image</Badge> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
