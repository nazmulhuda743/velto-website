import Link from "@/components/i18n/Link";
import { dictionary } from "@/content/i18n";
import { getLocale } from "@/lib/i18n/server";

export type Crumb = { label: string; href?: string };

export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = dictionary(await getLocale()).common;
  return (
    <nav aria-label={t.breadcrumb}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 t-caption text-secondary">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.href ? (
              <Link href={item.href} className="rounded-sm py-1 hover:text-navy">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="py-1 text-navy">
                {item.label}
              </span>
            )}
            {i < items.length - 1 ? <span aria-hidden="true">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
