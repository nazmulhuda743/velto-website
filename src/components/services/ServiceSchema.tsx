import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema, buildServiceSchema } from "@/lib/seo/schema";

/**
 * Service + breadcrumb structured data. The provider is the site-wide
 * Organization; outlets are referenced by id. No prices (they change in Ops)
 * and no ratings (counts need re-verification, and self-serving review markup
 * isn't eligible for rich results).
 */
export function ServiceSchema({
  name,
  description,
  path,
  crumbs,
}: {
  name: string;
  description: string;
  path: string;
  crumbs: { label: string; path: string }[];
}) {
  return <JsonLd data={[buildServiceSchema({ name, description, path }), buildBreadcrumbSchema(crumbs)]} />;
}
