import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceViewTracker } from "@/components/analytics/ServiceViewTracker";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICE_PAGES, getServicePage } from "@/content/services";
import { getLocale } from "@/lib/i18n/server";

// Unknown slugs 404 via notFound(). dynamicParams=false would also 404 the real pages
// after an admin save revalidates the layout (Next.js NoFallbackError on regeneration).
export const dynamicParams = true;
/** Price tables come from the public pricing view; refresh them every 5 minutes. */
export const revalidate = 300;

export function generateStaticParams() {
  return SERVICE_PAGES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return getServicePage(slug) ? pageMetadata(`/services/${slug}`) : {};
}

export default async function ServiceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServicePage(slug, await getLocale());
  if (!service) notFound();
  return (
    <>
      <ServiceViewTracker service={service.slug} />
      <ServicePage service={service} />
    </>
  );
}
